window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-input-history",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/history.ts
		/** The resting state: not browsing, nothing saved. */
		const IDLE = {
			index: null,
			savedDraft: ""
		};
		/**
		* Extract the plain-text of one user message: concatenated `text` blocks.
		* The blocks are treated structurally (any array works) so the module never
		* needs the LLM ContentBlock type — a cross-package dependency.
		* @param blocks - the message content blocks.
		* @returns the concatenated text, untrimmed.
		*/
		function textOf(blocks) {
			let text = "";
			for (const block of blocks) {
				if (typeof block !== "object" || block === null) continue;
				const record = block;
				if (record.type !== "text" || typeof record.text !== "string") continue;
				text += record.text;
			}
			return text;
		}
		/**
		* Build the recallable history for one session: every non-blank user
		* message, newest last, with adjacent duplicates collapsed (rapid re-sends
		* of the same text must not produce repeated recall entries).
		* @param nodes - the conversation snapshot nodes.
		* @returns history in chronological order; recall walks it backwards.
		*/
		function extractHistory(nodes) {
			const out = [];
			for (const node of nodes) {
				if (node.kind !== "user") continue;
				const trimmed = textOf(node.content).trim();
				if (trimmed === "") continue;
				const last = out[out.length - 1];
				if (last !== void 0 && last === trimmed) continue;
				out.push(trimmed);
			}
			return out;
		}
		/**
		* Ctrl+Up: enter history recall or move one entry older.
		* First press saves the current draft (the live state) and shows the newest
		* entry; subsequent presses walk older toward index 0.
		* @param history - extracted history (chronological).
		* @param draft - the composer draft at press time.
		* @param browse - current browse state.
		* @returns the next state and the text to fill.
		*/
		function up(history, draft, browse) {
			if (history.length === 0) return {
				browse,
				text: null
			};
			if (browse.index === null) {
				const nextIndex = history.length - 1;
				return {
					browse: {
						index: nextIndex,
						savedDraft: draft
					},
					text: history[nextIndex] ?? null
				};
			}
			if (browse.index === 0) return {
				browse,
				text: null
			};
			const nextIndex = browse.index - 1;
			return {
				browse: {
					...browse,
					index: nextIndex
				},
				text: history[nextIndex] ?? null
			};
		}
		/**
		* Ctrl+Down: move one entry newer, or return to live.
		* At the newest entry another press returns to live, restoring the draft
		* saved on the first Ctrl+Up (the empty draft restores as empty).
		* @param history - extracted history (chronological).
		* @param browse - current browse state.
		* @returns the next state and the text to fill (null while already live).
		*/
		function down(history, browse) {
			if (browse.index === null) return {
				browse,
				text: null
			};
			if (browse.index === history.length - 1) return {
				browse: IDLE,
				text: browse.savedDraft
			};
			const nextIndex = browse.index + 1;
			return {
				browse: {
					...browse,
					index: nextIndex
				},
				text: history[nextIndex] ?? null
			};
		}
		/**
		* Re-sync after the composer changed without our keyboard path (typing,
		* paste, a send clearing the draft, a new message arriving): any draft that
		* no longer equals the shown history entry drops the browse state, so the
		* next Ctrl+Up starts fresh from the newest entry.
		* @param history - extracted history (chronological).
		* @param draft - the current composer draft.
		* @param browse - current browse state.
		* @returns the resynced state.
		*/
		function resync(history, draft, browse) {
			if (browse.index === null) return browse;
			if (history[browse.index] === draft) return browse;
			return IDLE;
		}
		//#endregion
		//#region src/client/compat.ts
		/**
		* Graceful-compatibility helper: instead of throwing when the running DSH
		* client API no longer matches what this plugin needs, render a fixed-position
		* remediation banner and degrade. Pure DOM (appended to document.body), so it
		* works regardless of which slots/services the host still provides.
		*/
		/** Escape one text value for interpolation into the banner's innerHTML. */
		function escapeHtml(value) {
			return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
		}
		/** Fixed-position banner styling; injected once the first banner mounts. */
		const BANNER_CSS = [
			"position:fixed",
			"z-index:2147483000",
			"right:12px",
			"bottom:12px",
			"max-width:min(380px,calc(100vw - 24px))",
			"background:#1e2430",
			"color:#e6ebf2",
			"border:1px solid #f0a52a",
			"border-radius:10px",
			"padding:12px 14px",
			"font:13px/1.6 system-ui,Segoe UI,sans-serif",
			"box-shadow:0 8px 24px rgba(0,0,0,.35)"
		].join(";");
		/** One remediation banner; duplicates by id are dropped, click dismisses. */
		function renderCompatBanner(id, pluginName, cause, steps) {
			if (typeof document === "undefined") return;
			if (document.querySelector(`[data-dsh-compat-banner="${id}"]`) !== null) return;
			const el = document.createElement("div");
			el.setAttribute("data-dsh-compat-banner", id);
			el.setAttribute("role", "alert");
			el.setAttribute("style", BANNER_CSS);
			const list = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
			el.innerHTML = [
				`<div style="font-weight:600;margin-bottom:4px">${escapeHtml(pluginName)} 与当前 DSH 不兼容</div>`,
				`<div style="margin-bottom:6px">原因：${escapeHtml(cause)}</div>`,
				`<div style="margin-bottom:4px">解决：</div>`,
				`<ol style="margin:0;padding-left:18px">${list}</ol>`,
				`<div style="margin-top:8px;color:#9aa4b2">点击关闭 · 更新后刷新页面即可</div>`
			].join("");
			el.addEventListener("click", () => {
				el.remove();
			});
			document.body.appendChild(el);
		}
		/** Fail-closed feature check: every required capability must be present. */
		function requireCapabilities(checks) {
			const missing = [];
			for (const [label, value] of checks) if (value === void 0 || value === null) missing.push(label);
			return missing;
		}
		/** Wrapper: run a plugin body, and on any missing capability or thrown error
		* render the remediation banner instead of crashing. */
		function applyWithCompat(pluginName, cause, steps, checks, body) {
			const missing = requireCapabilities(checks);
			if (missing.length > 0) {
				renderCompatBanner(pluginName, pluginName, `${cause}(缺失：${missing.join("、")})`, steps);
				return;
			}
			try {
				body();
			} catch (error) {
				renderCompatBanner(pluginName, pluginName, `${cause}(错误：${String(error?.message ?? error)})`, steps);
			}
		}
		//#endregion
		//#region src/client/update-check.ts
		/**
		* Client-side version check + click-to-update for the whale update chip.
		* Version query prefers the host same-origin endpoint (no GitHub CORS), then
		* the GitHub tags API / raw package.json as fallback.
		*/
		const PLUGIN_VERSION = "0.1.33";
		const MIRROR = "lhh010/dsh-input-history";
		const UPDATE_ID = "dsh-input-history";
		const PACKAGE_SPEC = "@dsh-external/dsh-input-history";
		function compareSemver(a, b) {
			const parse = (v) => {
				const p = v.replace(/^v/, "").split(".").map((x) => Number(x) || 0);
				while (p.length < 3) p.push(0);
				return p;
			};
			const pa = parse(a);
			const pb = parse(b);
			return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
		}
		async function latestFromHost() {
			try {
				const res = await fetch(`/${UPDATE_ID}/latest`, {
					method: "GET",
					signal: AbortSignal.timeout(9e3)
				});
				if (!res.ok) return void 0;
				const raw = await res.json();
				const latest = typeof raw.latest === "string" && /^v\d+\.\d+\.\d+$/.test(raw.latest) ? raw.latest : void 0;
				if (latest === void 0) return void 0;
				return {
					latest,
					dshVersion: typeof raw.dshVersion === "string" && raw.dshVersion !== "" ? raw.dshVersion : void 0,
					latestSupported: typeof raw.latestSupported === "string" && /^v\d+\.\d+\.\d+$/.test(raw.latestSupported) ? raw.latestSupported : void 0,
					compat: raw.compat === true
				};
			} catch {
				return;
			}
		}
		async function latestFromTags() {
			try {
				const res = await fetch(`https://api.github.com/repos/${MIRROR}/tags?per_page=10`, {
					headers: { accept: "application/vnd.github+json" },
					signal: AbortSignal.timeout(8e3)
				});
				if (!res.ok) return void 0;
				const tags = await res.json();
				if (!Array.isArray(tags)) return void 0;
				const stable = tags.map((e) => e.name).filter((n) => typeof n === "string" && /^v\d+\.\d+\.\d+$/.test(n));
				if (stable.length === 0) return void 0;
				return stable.reduce((newest, t) => compareSemver(t, newest) > 0 ? t : newest);
			} catch {
				return;
			}
		}
		async function latestFromRaw() {
			try {
				const res = await fetch(`https://raw.githubusercontent.com/${MIRROR}/main/package.json`, { signal: AbortSignal.timeout(8e3) });
				if (!res.ok) return void 0;
				const version = (await res.json()).version;
				return typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version) ? `v${version}` : void 0;
			} catch {
				return;
			}
		}
		async function fetchUpdateInfo() {
			const [host, tags, raw] = await Promise.all([
				latestFromHost(),
				latestFromTags(),
				latestFromRaw()
			]);
			const latest = host?.latest ?? tags ?? raw;
			if (latest === void 0) return void 0;
			return {
				latest,
				dshVersion: host?.dshVersion,
				latestSupported: host?.latestSupported,
				compat: host?.compat
			};
		}
		/** Decide the update-chip message from the local version and the gated remote info. */
		function decideUpdate(local, info) {
			const { latest } = info;
			if (compareSemver(latest, local) <= 0) return {
				kind: "current",
				tag: latest
			};
			const dshVersion = info.dshVersion;
			if (dshVersion === void 0 || info.compat !== true) return {
				kind: "available",
				tag: latest
			};
			const supported = info.latestSupported !== void 0 && compareSemver(info.latestSupported, local) > 0 ? info.latestSupported : void 0;
			if (supported === void 0) return {
				kind: "blocked",
				tag: latest,
				dshVersion
			};
			if (compareSemver(supported, latest) >= 0) return {
				kind: "available",
				tag: latest
			};
			return {
				kind: "partial",
				tag: supported,
				blocked: latest,
				dshVersion
			};
		}
		function updatePrompt(tag) {
			return [
				`帮我更新 ${UPDATE_ID} 插件到 ${tag}，步骤：`,
				`0. 先执行 dsh --version 确认本地 DSH 版本，并对照 https://github.com/${MIRROR} 的 README「版本兼容」表——不同 DSH 版本需安装不同插件 tag，装错版本会启动崩溃；若本提示词给的 tag 与你的 DSH 版本不匹配，请改装表中对应 tag`,
				`1. 执行 dsh plugin --profile web add '${PACKAGE_SPEC}@github:${MIRROR}#${tag}'（首次可能被 pnpm 11 拦截构建脚本，则先在 ~/.dsh/profiles/web 执行 pnpm approve-builds --all）`,
				"2. 完成后提醒我硬刷新浏览器（Ctrl/Cmd+Shift+R）",
				`3. 遇到安装失败 / 版本不匹配 / 启动报错：先查 https://github.com/${MIRROR} README 的「版本兼容」与「已知限制」章节再排查`
			].join("\n");
		}
		async function runUpdate(tag) {
			try {
				const res = await fetch(`/${UPDATE_ID}/update`, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						"x-dsh-plugin-update": "click"
					},
					body: JSON.stringify({ tag }),
					signal: AbortSignal.timeout(13e4)
				});
				const parsed = await res.json().catch(() => ({}));
				return {
					ok: res.ok && parsed.ok === true,
					detail: typeof parsed.output === "string" ? parsed.output : parsed.error ?? String(res.status),
					link: parsed.link === true,
					...typeof parsed.recovery === "string" ? { recovery: parsed.recovery } : {},
					...parsed.hostChanged === true ? { hostChanged: true } : {}
				};
			} catch (e) {
				return {
					ok: false,
					detail: String(e?.message ?? e)
				};
			}
		}
		//#endregion
		//#region src/client/update-chip.ts
		/**
		* Floating update chip: appears once when a newer version exists; click updates
		* via the host endpoint (falling back to copying the prompt). Self-contained
		* fixed DOM with a close (×) button; all `[data-update-chip]` elements across
		* plugins are stacked into one non-overlapping column by a shared relayout, so
		* update prompts never overlap each other. When the version check fails
		* (network unreachable), a neutral gray chip with a retry button shows instead.
		*/
		let started = false;
		function startUpdateChip() {
			if (started) return;
			started = true;
			checkOnce();
		}
		async function checkOnce() {
			const info = await fetchUpdateInfo();
			if (info === void 0) {
				renderOfflineChip();
				return;
			}
			const notice = decideUpdate(PLUGIN_VERSION, info);
			if (notice.kind === "current") {
				renderCurrentChip(notice.tag);
				return notice;
			}
			if (notice.kind === "available") {
				renderChip(notice.tag);
				return notice;
			}
			if (notice.kind === "partial") {
				renderChip(notice.tag, notice);
				return notice;
			}
			renderBlockedChip(notice.tag, notice.dshVersion);
			return notice;
		}
		/** Reflow every visible update chip into a non-overlapping vertical column. */
		function relayout() {
			const chips = Array.from(document.querySelectorAll("[data-update-chip]"));
			let next = 12;
			for (const chip of chips) {
				chip.style.bottom = `${next}px`;
				next += chip.getBoundingClientRect().height + 8;
			}
		}
		const LABEL = "输入历史";
		function renderChip(tag, partial) {
			if (document.querySelector(`[data-update-chip="dsh-input-history"]`) !== null) return;
			const el = document.createElement("div");
			el.setAttribute("data-update-chip", UPDATE_ID);
			el.setAttribute("role", "button");
			el.setAttribute("title", partial === void 0 ? `更新到 ${tag}` : `更新到 ${tag}（另有 ${partial.blocked} 需要更高 DSH 版本，当前 DSH ${partial.dshVersion} 不支持）`);
			el.style.cssText = "position:fixed;left:12px;z-index:2147483000;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #4a7dff;border-radius:10px;background:#1e2430;color:#cfe0ff;font:12px/1.4 system-ui,Segoe UI,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35);";
			const label = document.createElement("span");
			label.style.cssText = "pointer-events:none;";
			label.textContent = partial === void 0 ? `⟳ ${LABEL} 新版本 ${tag} 可用，点击更新` : `⟳ ${LABEL} 新版本 ${tag} 可用（${partial.blocked} 需更高 DSH）`;
			const close = document.createElement("button");
			close.textContent = "×";
			close.setAttribute("aria-label", "关闭");
			close.title = "关闭";
			close.style.cssText = "pointer-events:auto;border:0;background:transparent;color:#8fa3c8;font:inherit;cursor:pointer;padding:0 2px;line-height:1;";
			close.addEventListener("click", (event) => {
				event.stopPropagation();
				el.remove();
				relayout();
			});
			el.appendChild(label);
			el.appendChild(close);
			el.addEventListener("pointerdown", (event) => {
				event.stopPropagation();
			});
			el.addEventListener("click", () => {
				label.textContent = "更新中…";
				runUpdate(tag).then((result) => {
					if (result.ok) {
						label.textContent = result.hostChanged === true ? `已更新到 ${tag}（含宿主侧变更），请重启 dsh 生效` : `已更新到 ${tag}，客户端自动刷新生效（未见变化可硬刷新 Ctrl/Cmd+Shift+R）`;
						el.setAttribute("title", "已更新，硬刷新生效");
						return;
					}
					if (result.link) {
						navigator.clipboard?.writeText(updatePrompt(tag)).then(() => {
							label.textContent = `本地 link 安装：已跳过自动更新，更新提示词已复制到剪贴板`;
						}).catch(() => {
							label.textContent = `本地 link：请手动执行 pnpm add '${PACKAGE_SPEC}@github:${MIRROR}#${tag}'`;
						});
						el.setAttribute("title", "悬停查看本地 link 说明");
						return;
					}
					navigator.clipboard?.writeText(updatePrompt(tag)).then(() => {
						label.textContent = `自动更新失败（详见剪贴板提示词）：${result.detail.slice(0, 80)}`;
					}).catch(() => {
						label.textContent = `自动更新失败：${result.detail.slice(0, 80)}`;
					});
					el.setAttribute("title", result.recovery !== void 0 ? `${result.detail}\n恢复命令：${result.recovery}` : result.detail);
				});
			});
			document.body.appendChild(el);
			relayout();
		}
		/** Neutral gray chip shown when the version check cannot reach the network. */
		function renderOfflineChip() {
			if (document.querySelector(`[data-update-chip="dsh-input-history"]`) !== null) return;
			const el = document.createElement("div");
			el.setAttribute("data-update-chip", UPDATE_ID);
			el.setAttribute("title", "无法连接宿主端点 / GitHub 查询新版本（可能是网络不可达）");
			el.style.cssText = "position:fixed;left:12px;z-index:2147483000;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #4a5060;border-radius:10px;background:#22252c;color:#9aa3b5;font:12px/1.4 system-ui,Segoe UI,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);";
			const label = document.createElement("span");
			label.style.cssText = "pointer-events:none;";
			label.textContent = `⚠ ${LABEL} 版本检查失败（网络不可达），点击重试`;
			const retry = document.createElement("button");
			retry.textContent = "重试";
			retry.setAttribute("aria-label", "重试版本检查");
			retry.style.cssText = "pointer-events:auto;border:0;background:transparent;color:#8fa3c8;font:inherit;cursor:pointer;padding:0 2px;line-height:1;";
			const close = document.createElement("button");
			close.textContent = "×";
			close.setAttribute("aria-label", "关闭");
			close.title = "关闭";
			close.style.cssText = "pointer-events:auto;border:0;background:transparent;color:#8fa3c8;font:inherit;cursor:pointer;padding:0 2px;line-height:1;";
			close.addEventListener("click", (event) => {
				event.stopPropagation();
				el.remove();
				relayout();
			});
			el.appendChild(label);
			el.appendChild(retry);
			el.appendChild(close);
			let retrying = false;
			const retryOnce = () => {
				if (retrying) return;
				retrying = true;
				label.textContent = "版本检查中…";
				checkOnce().then((notice) => {
					retrying = false;
					if (notice === void 0) {
						label.textContent = `⚠ ${LABEL} 仍无法查询新版本`;
						return;
					}
					el.remove();
					relayout();
				});
			};
			retry.addEventListener("click", (event) => {
				event.stopPropagation();
				retryOnce();
			});
			el.addEventListener("click", (event) => {
				if (event.target.closest("button") === null) retryOnce();
			});
			document.body.appendChild(el);
			relayout();
		}
		/** Amber informational chip: the newest release needs a DSH version this host does not run. */
		function renderBlockedChip(tag, dshVersion) {
			if (document.querySelector(`[data-update-chip="dsh-input-history"]`) !== null) return;
			const el = document.createElement("div");
			el.setAttribute("data-update-chip", UPDATE_ID);
			el.setAttribute("title", `新版本 ${tag} 支持更高的 DSH 版本，但不支持当前 DSH ${dshVersion}；升级 DSH 后再更新插件`);
			el.style.cssText = "position:fixed;left:12px;z-index:2147483000;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #8a6d2f;border-radius:10px;background:#2d2718;color:#e8cf9a;font:12px/1.4 system-ui,Segoe UI,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);";
			const label = document.createElement("span");
			label.style.cssText = "pointer-events:none;";
			label.textContent = `⧗ ${LABEL} 新版本 ${tag} 支持更高 DSH 版本，当前 DSH ${dshVersion} 暂不可用`;
			const close = document.createElement("button");
			close.textContent = "×";
			close.setAttribute("aria-label", "关闭");
			close.title = "关闭";
			close.style.cssText = "pointer-events:auto;border:0;background:transparent;color:#b7a677;font:inherit;cursor:pointer;padding:0 2px;line-height:1;";
			close.addEventListener("click", (event) => {
				event.stopPropagation();
				el.remove();
				relayout();
			});
			el.appendChild(label);
			el.appendChild(close);
			el.addEventListener("pointerdown", (event) => {
				event.stopPropagation();
			});
			document.body.appendChild(el);
			relayout();
		}
		/** Transient confirmation when the check succeeds and we are already current. */
		function renderCurrentChip(tag) {
			if (document.querySelector(`[data-update-chip="dsh-input-history"]`) !== null) return;
			const el = document.createElement("div");
			el.setAttribute("data-update-chip", UPDATE_ID);
			el.setAttribute("title", "版本检查成功，当前已是最新版本");
			el.style.cssText = "position:fixed;left:12px;z-index:2147483000;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #2f5d3a;border-radius:10px;background:#1c2a22;color:#9fd8ae;font:12px/1.4 system-ui,Segoe UI,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);";
			const label = document.createElement("span");
			label.style.cssText = "pointer-events:none;";
			label.textContent = `✓ ${LABEL} 已是最新版本 ${tag}`;
			el.appendChild(label);
			el.addEventListener("pointerdown", (event) => {
				event.stopPropagation();
			});
			el.addEventListener("click", () => {
				el.remove();
				relayout();
			});
			document.body.appendChild(el);
			relayout();
			setTimeout(() => {
				el.remove();
				relayout();
			}, 4e3);
		}
		//#endregion
		//#region src/client/index.ts
		/** Stable Cordis plugin name (matches the manifest id). */
		const name = "dsh-input-history";
		/**
		* Required services: the sessions face (current session + scope reads), the
		* target-neutral Conversation assembly (chat view nodes), and the
		* scope-addressed conversation face (input machine writes). All are
		* root-level services provided by the stock web app.
		*/
		const inject = [
			"sessions",
			"uiSession",
			"uiConversation",
			"conversation"
		];
		/**
		* Whether the keydown/input target is inside the conversation composer
		* surface. The composer is a contenteditable div hosted inside the
		* `data-input-scroll` frame, so the check stays robust against CSS-module
		* class hashing and contenteditable host changes.
		* @param target - the event target.
		* @returns true when the target is inside the composer.
		*/
		function isComposerTarget(target) {
			if (!(target instanceof HTMLElement)) return false;
			return target.closest("[data-input-scroll]") !== null;
		}
		const EMPTY_NODES = [];
		/**
		* Browser plugin body: capture Ctrl+Up / Ctrl+Down on the composer and drive
		* the input machine's draft through the pure history state machine. A live
		* composer edit or a session switch drops the browse state (the input event
		* re-sync covers both, plus sends clearing the draft).
		* @param ctx - client root context.
		*/
		function applyBody(ctx) {
			let browse = IDLE;
			let lastSessionId;
			const sessions = ctx.sessions;
			/**
			* dsh 0.1.6-alpha.2: the main session moved to the uiSession service
			* ({ key: sessionId, ctx: session scope } per the multi-instance
			* refactor); alpha.1 exposed it as sessions.list 'current'. Both paths
			* resolve to { sessionId, scope }.
			*/
			const currentSession = () => {
				if (ctx.uiSession !== void 0) {
					const snap = ctx.uiSession.adapter.current.getSnapshot();
					if (snap !== void 0 && snap.key !== void 0 && snap.ctx !== void 0) return {
						sessionId: snap.key,
						scope: snap.ctx
					};
					return null;
				}
				const id = sessions.list.getSnapshot().current;
				if (id === void 0) return null;
				const scope = sessions.scope(id);
				return scope === void 0 ? null : {
					sessionId: id,
					scope
				};
			};
			const resolve = () => {
				const current = currentSession();
				if (current === null) return null;
				const { sessionId: id, scope } = current;
				if (id !== lastSessionId) {
					browse = IDLE;
					lastSessionId = id;
				}
				const conversation = scope.get("conversation");
				if (conversation === void 0) return null;
				let chat;
				try {
					chat = ctx.uiConversation.binding(id).snapshot.getSnapshot().views.get("chat");
				} catch (cause) {
					console.warn("[dsh-input-history] chat view unavailable:", cause);
					return null;
				}
				const nodes = chat === void 0 ? EMPTY_NODES : chat.legacy.nodes;
				const input = conversation.input.for?.(scope);
				if (input === void 0) {
					console.warn("[dsh-input-history] conversation.input.for unavailable");
					return null;
				}
				return {
					input,
					nodes
				};
			};
			const onKeyDown = (e) => {
				if (!e.ctrlKey || e.altKey || e.metaKey) return;
				if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
				if (e.isComposing) return;
				if (!isComposerTarget(e.target)) return;
				const resolved = resolve();
				if (resolved === null) return;
				const history = extractHistory(resolved.nodes);
				const draft = resolved.input.state.getSnapshot().draft;
				const step = e.key === "ArrowUp" ? up(history, draft, browse) : down(history, browse);
				const text = step.text;
				if (text === null) return;
				e.preventDefault();
				e.stopPropagation();
				browse = step.browse;
				resolved.input.setDraft(text);
			};
			const onInput = (e) => {
				if (!isComposerTarget(e.target)) return;
				const resolved = resolve();
				if (resolved === null) return;
				browse = resync(extractHistory(resolved.nodes), resolved.input.state.getSnapshot().draft, browse);
			};
			ctx.effect(() => {
				window.addEventListener("keydown", onKeyDown, true);
				window.addEventListener("input", onInput, true);
				return () => {
					window.removeEventListener("keydown", onKeyDown, true);
					window.removeEventListener("input", onInput, true);
				};
			}, "dsh-input-history: composer keyboard capture");
		}
		/**
		* Client plugin entry: run {@link applyBody} behind a graceful-compatibility
		* guard — when the running DSH lacks the client APIs this plugin needs, a
		* remediation banner renders instead of a thrown activation error.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			startUpdateChip();
			applyWithCompat("@dsh-external/dsh-input-history", "当前 DSH 客户端 API 与插件不匹配", [
				"将 DSH 升级到已适配的版本（dsh-v0.1.2-alpha.1，源码构建安装）。",
				"或将插件更新到适配当前 DSH 的版本（仓库最新 tag）。",
				"如仍显示，请在插件目录执行 pnpm run build 后刷新页面。"
			], [
				["sessions.list", ctx?.sessions?.list],
				["sessions.scope", ctx?.sessions?.scope],
				["sessions.sessionOf", ctx?.sessions?.sessionOf],
				["uiConversation.binding", ctx?.uiConversation?.binding]
			], () => {
				applyBody(ctx);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
