import { useEffect, useRef, useState } from "react";
import type { WorkbenchTab } from "@codeagent-studio/protocol";
import { FileExplorer } from "../files/FileExplorer.js";
import { ChatPanel } from "../chat/ChatPanel.js";
import { EditorTab } from "../editor/EditorTab.js";
import {
  IconArrowDown,
  IconChat,
  IconFile,
  IconPlus,
  IconSparkle,
  IconTrash,
  IconX,
  IconMore,
  IconMoon,
  IconSun,
} from "../icons.js";

type Activity = "files" | "sessions";
export function Workbench() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("codeagent-theme");
    return saved === "light" ? "light" : "dark";
  });
  const [activity, setActivity] = useState<Activity>("sessions");
  const [sessionView, setSessionView] = useState<"sessions" | "projects">(
    "sessions",
  );
  const [expandedProjectId, setExpandedProjectId] = useState<string>();
  const [tabs, setTabs] = useState<WorkbenchTab[]>([
    { kind: "chat", sessionId: "new-chat", scope: "personal", provider: "claude" },
  ]);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(tabs[0]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState<string>();
  const [projectName, setProjectName] = useState("未选择项目");
  const [projectRoot, setProjectRoot] = useState<string | undefined>();
  const [registeredProjects, setRegisteredProjects] = useState<
    Array<{ id: string; name?: string; rootPath?: string }>
  >([]);
  const [personalSessions, setPersonalSessions] = useState<
    Array<{
      id: string;
      provider: string;
      title?: string;
      projectId?: string;
      projectName?: string;
      projectRoot?: string;
      nativeId?: string;
      updatedAt?: number;
    }>
  >([]);
  const [projectSessions, setProjectSessions] = useState<
    Array<{
      id: string;
      provider: string;
      title?: string;
      projectId?: string;
      projectName?: string;
      projectRoot?: string;
      nativeId?: string;
      updatedAt?: number;
    }>
  >([]);
  const [providerStatuses, setProviderStatuses] = useState<
    Array<{
      provider: string;
      command?: string;
      installed: boolean;
      version?: string;
    }>
  >([]);
  const [detectingProviders, setDetectingProviders] = useState(false);
  const [providerDetectionError, setProviderDetectionError] = useState<
    string | undefined
  >();
  const [latency, setLatency] = useState(42);
  const [activeStats, setActiveStats] = useState({ rounds: 0, tokens: 0 });
  const [projectError, setProjectError] = useState<string | undefined>();
  const [pendingDelete, setPendingDelete] = useState<string>();
  const deleteTimer = useRef<number>();
  const providerId = (value?: string) =>
    (value ?? "claude").toLowerCase() as
      "claude" | "cursor" | "codex" | "pi" | "opencode";
  const providerLabel = (value?: string) => {
    const id = providerId(value);
    return id === "opencode" ? "OpenCode" : id[0]!.toUpperCase() + id.slice(1);
  };
  const activeProvider = providerId(
    activeTab.kind === "chat" ? activeTab.provider : undefined,
  );
  const [selectedProvider, setSelectedProvider] = useState(activeProvider);
  useEffect(() => {
    setSelectedProvider(activeProvider);
  }, [activeProvider]);
  const visiblePersonalSessions = personalSessions.filter(
    (session) => providerId(session.provider) === selectedProvider,
  );
  const visibleProjectSessions = projectSessions.filter(
    (session) => providerId(session.provider) === selectedProvider,
  );
  const projectGroups = visibleProjectSessions.reduce((groups, session) => {
    const registeredByRoot = session.projectRoot
      ? registeredProjects.find((project) => project.rootPath === session.projectRoot)
      : undefined;
    const linkedProjectId = session.projectId ?? registeredByRoot?.id;
    const key =
      linkedProjectId ??
      session.projectRoot ??
      session.projectName ??
      "unlinked";
    const registered = linkedProjectId
      ? registeredProjects.find((project) => project.id === linkedProjectId)
      : undefined;
    const current = groups.get(key) ?? {
      name:
        session.projectName ??
        registered?.name ??
        registered?.rootPath?.split(/[\\/]/).pop() ??
        "未关联项目",
      root: session.projectRoot,
      sessions: [] as typeof visibleProjectSessions,
    };
    current.sessions.push(session);
    groups.set(key, current);
    return groups;
  }, new Map<string, { name: string; root?: string; sessions: typeof visibleProjectSessions }>());
  registeredProjects.forEach((project) => {
    if (!projectGroups.has(project.id))
      projectGroups.set(project.id, {
        name: project.name ?? project.rootPath?.split(/[\\/]/).pop() ?? "项目",
        root: project.rootPath,
        sessions: [],
      });
  });
  useEffect(() => {
    const api = (
      window as Window & {
        codeagent?: {
          workspace?: {
            projects: () => Promise<
              Array<{ id: string; name?: string; rootPath?: string }>
            >;
          };
        };
      }
    ).codeagent?.workspace;
    if (!api) return;
    void api
      .projects()
      .then((projects) => {
        setRegisteredProjects(projects);
        if (projects[0]) {
          setProjectId(projects[0].id);
          setProjectName(
            projects[0].name ??
              projects[0].rootPath?.split(/[\\/]/).pop() ??
              "项目",
          );
          setProjectRoot(projects[0].rootPath);
        }
      })
      .catch(() => setProjectError("项目列表加载失败，请重新选择项目。"));
  }, []);
  useEffect(
    () => () => {
      if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    },
    [],
  );
  useEffect(() => {
    const list = (
      window as Window & {
        codeagentSessions?: {
          list: () => Promise<
            Array<{
              id: string;
              provider: string;
              scope: "personal" | "project";
              title?: string;
              projectId?: string;
              projectName?: string;
              projectRoot?: string;
              nativeId?: string;
              updatedAt?: number;
            }>
          >;
        };
      }
    ).codeagentSessions?.list;
    if (list)
      void list().then((sessions) => {
        setPersonalSessions(
          sessions.filter((session) => session.scope === "personal"),
        );
        setProjectSessions(
          sessions.filter((session) => session.scope === "project"),
        );
      });
  }, []);
  const detectProviders = () => {
    const detect = (
      window as Window & {
        codeagent?: {
          providers?: {
            detect: () => Promise<
              Array<{
                provider: string;
                installed: boolean;
                version?: string;
                command?: string;
              }>
            >;
          };
        };
      }
    ).codeagent?.providers?.detect;
    if (detectingProviders) return;
    if (!detect) {
      setProviderDetectionError("Agent 检测接口不可用，请重启应用。");
      setDetectingProviders(false);
      return;
    }
    setDetectingProviders(true);
    setProviderDetectionError(undefined);
    const timeout = new Promise<never>((_, reject) =>
      window.setTimeout(
        () => reject(new Error("provider-detect-timeout")),
        8_000,
      ),
    );
    void Promise.race([detect(), timeout])
      .then(setProviderStatuses)
      .catch(() =>
        setProviderDetectionError(
          "Agent 检测超时或失败，请检查系统权限和 PATH。",
        ),
      )
      .finally(() => setDetectingProviders(false));
  };
  useEffect(() => {
    detectProviders();
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () => setLatency(34 + Math.floor(Math.random() * 28)),
      2000,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("codeagent-theme", theme);
  }, [theme]);
  useEffect(() => {
    const handleTitle = (event: Event) => {
      const detail = (
        event as CustomEvent<{ sessionId?: string; title?: string }>
      ).detail;
      if (!detail.sessionId || !detail.title) return;
      setPersonalSessions((items) =>
        items.map((item) =>
          item.id === detail.sessionId
            ? { ...item, title: detail.title }
            : item,
        ),
      );
      setProjectSessions((items) =>
        items.map((item) =>
          item.id === detail.sessionId
            ? { ...item, title: detail.title }
            : item,
        ),
      );
    };
    window.addEventListener("codeagent:session-title", handleTitle);
    return () =>
      window.removeEventListener("codeagent:session-title", handleTitle);
  }, []);

  const openFile = async (path: string) => {
    if (!projectId) return;
    const fileTab: WorkbenchTab = {
      kind: "file",
      projectId,
      path,
      dirty: false,
    };
    const api = (
      window as Window & {
        codeagent?: {
          workspace?: {
            read: (projectId: string, path: string) => Promise<string>;
          };
        };
      }
    ).codeagent?.workspace;
    if (api) {
      try {
        const content = await api.read(projectId, path);
        setFileContents((current) => ({
          ...current,
          [`${projectId}:${path}`]: content,
        }));
      } catch {
        setFileContents((current) => ({
          ...current,
          [`${projectId}:${path}`]: current[`${projectId}:${path}`] ?? "",
        }));
      }
    }
    setTabs((current) =>
      current.some((tab) => tab.kind === "file" && tab.path === fileTab.path)
        ? current
        : [...current, fileTab],
    );
    setActiveTab(fileTab);
  };

  const sessionTitle = (id: string, nativeId?: string, title?: string) => {
    const raw =
      title?.trim() || nativeId || id.replace(/^(personal|project)-/, "");
    return raw === "new-chat"
      ? "新对话"
      : raw.length > 80
        ? `${raw.slice(0, 77)}…`
        : raw;
  };
  const relativeTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.round(hours / 24)} 天前`;
  };
  const tabName = (tab: WorkbenchTab) =>
    tab.kind === "chat"
      ? (() => {
          const session = [...personalSessions, ...projectSessions].find(
            (item) => item.id === tab.sessionId,
          );
          return `${providerLabel(tab.provider ?? session?.provider)} · ${sessionTitle(
            tab.sessionId,
            session?.nativeId,
            session?.title,
          )}`;
        })()
      : (tab.path.split("/").pop() ?? tab.path);
  const isSameTab = (left: WorkbenchTab, right: WorkbenchTab) =>
    left.kind === right.kind &&
    (left.kind === "chat" && right.kind === "chat"
      ? left.sessionId === right.sessionId
      : left.kind === "file" &&
        right.kind === "file" &&
        left.projectId === right.projectId &&
        left.path === right.path);
  const openSession = (
    id: string,
    scope: "personal" | "project",
    provider: string,
    sessionProjectId?: string,
    sessionProjectName?: string,
    sessionProjectRoot?: string,
  ) => {
    if (scope === "project") {
      const registered = sessionProjectId
        ? registeredProjects.find((project) => project.id === sessionProjectId)
        : undefined;
      if (sessionProjectId) setProjectId(sessionProjectId);
      if (sessionProjectName || sessionProjectRoot || registered) {
        setProjectName(
          sessionProjectName ??
            registered?.name ??
            sessionProjectRoot?.split(/[\\/]/).pop() ??
            "项目",
        );
        setProjectRoot(sessionProjectRoot ?? registered?.rootPath);
      }
    }
    const existing = tabs.find(
      (tab) => tab.kind === "chat" && tab.sessionId === id,
    );
    const tab: WorkbenchTab = existing
      ? {
          ...existing,
          scope,
          provider: providerId(provider),
          ...(sessionProjectId ? { projectId: sessionProjectId } : {}),
        }
      : {
      kind: "chat",
      sessionId: id,
      scope,
      provider: provider as "claude" | "cursor" | "codex" | "pi" | "opencode",
      projectId: sessionProjectId,
    };
    if (!existing) setTabs((items) => [...items, tab]);
    setActiveTab(tab);
  };
  const newSession = (scope: "personal" | "project") => {
    const id = `${scope}-${crypto.randomUUID()}`;
    const provider = selectedProvider;
    const sessionProjectId = scope === "project" ? projectId : undefined;
    const create = (
      window as Window & {
        codeagentSessions?: { create: (input: unknown) => Promise<unknown> };
      }
    ).codeagentSessions?.create;
    if (create)
      void create({
        id,
        provider,
        scope,
        ...(sessionProjectId ? { projectId: sessionProjectId } : {}),
      });
    scope === "personal"
      ? setPersonalSessions((items) => [...items, { id, provider }])
      : setProjectSessions((items) => [
          ...items,
          { id, provider, projectId: sessionProjectId },
        ]);
    const tab = {
      kind: "chat" as const,
      sessionId: id,
      scope,
      provider,
      ...(sessionProjectId ? { projectId: sessionProjectId } : {}),
    };
    setTabs((items) => [...items, tab]);
    setActiveTab(tab);
  };
  const changeProvider = (value: string) => {
    const provider = providerId(value);
    setSelectedProvider(provider);
    if (activeTab.kind !== "chat") return;
    setTabs((items) =>
      items.map((tab) =>
        isSameTab(tab, activeTab) && tab.kind === "chat"
          ? { ...tab, provider }
          : tab,
      ),
    );
    setActiveTab((tab) => (tab.kind === "chat" ? { ...tab, provider } : tab));
  };
  const closeTab = (tab: WorkbenchTab) => {
    setTabs((items) => {
      const index = items.findIndex((item) => isSameTab(item, tab));
      const next = items.filter((item) => !isSameTab(item, tab));
      if (isSameTab(activeTab, tab)) {
        const fallback = next[index] ??
          next[index - 1] ?? {
            kind: "chat" as const,
            sessionId: "new-chat",
            scope: "personal" as const,
            provider: selectedProvider,
          };
        setActiveTab(fallback);
      }
      return next;
    });
  };
  const deleteActiveSession = () => {
    if (activeTab.kind !== "chat" || activeTab.sessionId === "new-chat") return;
    if (!window.confirm("确定删除当前会话及其历史消息吗？")) return;
    const remove = (
      window as Window & {
        codeagentSessions?: { delete?: (id: string) => Promise<unknown> };
      }
    ).codeagentSessions?.delete;
    if (remove) void remove(activeTab.sessionId);
    setPersonalSessions((items) =>
      items.filter((item) => item.id !== activeTab.sessionId),
    );
    setProjectSessions((items) =>
      items.filter((item) => item.id !== activeTab.sessionId),
    );
    closeTab(activeTab);
  };
  const requestDelete = (id: string) => {
    if (pendingDelete === id) {
      const remove = (
        window as Window & {
          codeagentSessions?: { delete?: (value: string) => Promise<unknown> };
        }
      ).codeagentSessions?.delete;
      if (remove) void remove(id);
      setPersonalSessions((items) => items.filter((item) => item.id !== id));
      setProjectSessions((items) => items.filter((item) => item.id !== id));
      setPendingDelete(undefined);
      if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
      if (activeTab.kind === "chat" && activeTab.sessionId === id)
        closeTab(activeTab);
      return;
    }
    setPendingDelete(id);
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    deleteTimer.current = window.setTimeout(
      () => setPendingDelete(undefined),
      2200,
    );
  };
  const activeSession =
    activeTab.kind === "chat"
      ? [...personalSessions, ...projectSessions].find(
          (session) => session.id === activeTab.sessionId,
        )
      : undefined;
  const activeTitle =
    activeTab.kind === "chat"
      ? sessionTitle(
          activeTab.sessionId,
          activeSession?.nativeId,
          activeSession?.title,
        )
      : tabName(activeTab);

  return (
    <div className={`codeagent-workbench app theme-${theme}`}>
      <aside className="sidebar" aria-label="活动栏">
        <div className="agent-brand brand">
          <span className="agent-brand-mark brand-mark">
            <IconSparkle size={13} />
          </span>
          <span className="brand-text">
            <strong className="brand-name">AGENT-01</strong>
            <small className="brand-sub">对话控制台</small>
          </span>
        </div>
        <div className="side-tabs" role="tablist" aria-label="工作区入口">
          <button
            className={`side-tab${activity === "files" ? " is-on" : ""}`}
            role="tab"
            aria-selected={activity === "files"}
            onClick={() => setActivity("files")}
          >
            文件
          </button>
          <button
            className={`side-tab${activity === "sessions" ? " is-on" : ""}`}
            role="tab"
            aria-selected={activity === "sessions"}
            onClick={() => setActivity("sessions")}
          >
            Agent 会话
          </button>
        </div>
        <section aria-label="侧栏">
          {activity === "files" ? (
            <div>
              <header className="sidebar-heading">
                <h2>文件资源管理器</h2>
                <button type="button" aria-label="侧栏更多操作">
                  <IconMore size={15} />
                </button>
              </header>
              <button
                type="button"
                className="project-picker"
                onClick={() => {
                  const choose = (
                    window as Window & {
                      codeagent?: {
                        workspace?: {
                          chooseProject: () => Promise<
                            | { id: string; name?: string; rootPath?: string }
                            | undefined
                          >;
                        };
                      };
                    }
                  ).codeagent?.workspace?.chooseProject;
                  if (!choose) {
                    setProjectError("项目选择接口不可用，请重启应用。");
                    return;
                  }
                  setProjectError(undefined);
                  void choose()
                    .then((project) => {
                      if (project) {
                        setProjectId(project.id);
                        setProjectName(
                          project.name ??
                            project.rootPath?.split(/[\\/]/).pop() ??
                            "项目",
                        );
                        setProjectRoot(project.rootPath);
                      }
                    })
                    .catch(() =>
                      setProjectError("项目选择失败，请确认目录可访问。"),
                    );
                }}
              >
                选择项目
              </button>
              {projectError && <p role="alert">{projectError}</p>}
              <FileExplorer
                projectId={projectId}
                projectName={projectName}
                onOpenFile={(path) => void openFile(path)}
              />
            </div>
          ) : (
            <div>
              <button
                type="button"
                className="side-new-row"
                onClick={() =>
                  newSession(
                    sessionView === "projects" ? "project" : "personal",
                  )
                }
              >
                <IconPlus size={15} /> 新建会话
              </button>
              <div
                className="nested-sidebar-tabs"
                role="tablist"
                aria-label="Agent 会话视图"
              >
                <button
                  role="tab"
                  aria-selected={sessionView === "sessions"}
                  onClick={() => setSessionView("sessions")}
                >
                  会话
                </button>
                <button
                  role="tab"
                  aria-selected={sessionView === "projects"}
                  onClick={() => setSessionView("projects")}
                >
                  项目
                </button>
              </div>
              <div className="session-sidebar-heading">
                <h2>{sessionView === "sessions" ? "会话" : "项目"}</h2>
              </div>
              {sessionView === "sessions" ? (
                <>
                  <h3 className="session-section-label">个人会话</h3>
                  <div className="conv-list">
                    {visiblePersonalSessions.length === 0 ? (
                      <p className="conv-empty">暂无 {providerLabel(selectedProvider)} 个人会话</p>
                    ) : (
                      visiblePersonalSessions.map(
                      ({
                        id,
                        provider,
                        projectId: sessionProjectId,
                        nativeId,
                        title,
                        updatedAt,
                      }) => (
                        <button
                          className="conv-item"
                          type="button"
                          aria-current={
                            activeTab.kind === "chat" &&
                            activeTab.sessionId === id
                          }
                          key={id}
                          onClick={() =>
                            openSession(
                              id,
                              "personal",
                              provider,
                              sessionProjectId,
                            )
                          }
                        >
                          <IconChat size={14} className="conv-icon" />
                          <span className="conv-title">
                            {providerLabel(provider)} ·{" "}
                            {sessionTitle(id, nativeId, title)}
                          </span>
                          <small className="conv-time">
                            {relativeTime(updatedAt)}
                          </small>
                          <span
                            role="button"
                            tabIndex={0}
                            className={`session-row-delete${pendingDelete === id ? " is-confirm" : ""}`}
                            aria-label={
                              pendingDelete === id
                                ? `再次点击确认删除 ${sessionTitle(id, nativeId, title)}`
                                : `删除会话 ${sessionTitle(id, nativeId, title)}`
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              requestDelete(id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                requestDelete(id);
                              }
                            }}
                          >
                            {pendingDelete === id ? (
                              "删除"
                            ) : (
                              <IconTrash size={12} />
                            )}
                          </span>
                        </button>
                      ),
                      )
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="conv-list">
                    {projectGroups.size === 0 ? (
                      <p className="conv-empty">暂无 {providerLabel(selectedProvider)} 项目</p>
                    ) : (
                      [...projectGroups.entries()].map(([key, group]) => (
                      <div
                        className="session-project-group proj-group"
                        data-expanded={
                          expandedProjectId === key ? "true" : "false"
                        }
                        key={key}
                      >
                        <div className="project-group-header proj-row">
                          <button
                            type="button"
                            className="proj-row-main"
                            aria-expanded={expandedProjectId === key}
                            onClick={() =>
                              setExpandedProjectId((current) =>
                                current === key ? undefined : key,
                              )
                            }
                            title={group.root}
                          >
                            <span className="proj-row-dot" aria-hidden="true" />
                            <span className="proj-row-name">{group.name}</span>
                            <small className="proj-row-count">
                              {group.sessions.length}
                            </small>
                            <span className="project-caret" aria-hidden="true">
                              <IconArrowDown size={13} />
                            </span>
                          </button>
                          <button
                            className="proj-row-plus"
                            type="button"
                            aria-label={`在 ${group.name} 中新建会话`}
                            onClick={(event) => {
                              event.stopPropagation();
                              const registered = registeredProjects.find(
                                (project) => project.id === key,
                              );
                              if (registered) {
                                setProjectId(registered.id);
                                setProjectName(
                                  registered.name ??
                                    registered.rootPath?.split(/[\\/]/).pop() ??
                                    "项目",
                                );
                                setProjectRoot(registered.rootPath);
                              } else {
                                const linked =
                                  group.sessions[0]?.projectId ??
                                  (group.root
                                    ? registeredProjects.find(
                                        (project) => project.rootPath === group.root,
                                      )?.id
                                    : undefined);
                                if (linked) setProjectId(linked);
                              }
                              newSession("project");
                            }}
                          >
                            <IconPlus size={14} />
                          </button>
                        </div>
                        {group.sessions.length === 0 ? (
                          <p className="project-no-sessions">
                            暂无会话，点击 + 新建
                          </p>
                        ) : (
                          group.sessions.map(
                            ({
                              id,
                              provider,
                              projectId: sessionProjectId,
                              projectName,
                              projectRoot,
                              nativeId,
                              title,
                              updatedAt,
                            }) => (
                              <button
                                className="proj-conv"
                                type="button"
                                aria-current={
                                  activeTab.kind === "chat" &&
                                  activeTab.sessionId === id
                                }
                                title={
                                  projectRoot ?? projectName ?? "未关联项目"
                                }
                                key={id}
                                onClick={() =>
                                  openSession(
                              id,
                              "project",
                              provider,
                              sessionProjectId,
                              projectName,
                              projectRoot,
                            )
                                }
                              >
                                <IconChat size={13} className="conv-icon" />
                                <span>
                                  {providerLabel(provider)} ·{" "}
                                  {sessionTitle(id, nativeId, title)}
                                </span>
                                <small>{relativeTime(updatedAt)}</small>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className={`session-row-delete${pendingDelete === id ? " is-confirm" : ""}`}
                                  aria-label={
                                    pendingDelete === id
                                      ? `再次点击确认删除 ${sessionTitle(id, nativeId, title)}`
                                      : `删除会话 ${sessionTitle(id, nativeId, title)}`
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    requestDelete(id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      (
                                        event.currentTarget as HTMLElement
                                      ).click();
                                    }
                                  }}
                                >
                                  {pendingDelete === id ? (
                                    "删除"
                                  ) : (
                                    <IconTrash size={12} />
                                  )}
                                </span>
                              </button>
                            ),
                          )
                        )}
                      </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
        <div className="side-status sidebar-status-card">
          <div className="side-status-row">
            <span className="pulse-dot status-pulse" />
            <span className="side-status-label">在线</span>
            <span className="side-status-val sidebar-status-value">{latency}ms</span>
          </div>
          <div className="side-status-row">
            <span className="side-status-label">Agent</span>
            <span className="side-status-val sidebar-status-value">
              {detectingProviders
                ? "检测中…"
                : providerStatuses.filter((status) => status.installed).length
                  ? `${providerStatuses.filter((status) => status.installed).length} 个就绪`
                  : "未就绪"}
            </span>
          </div>
          <button
            type="button"
            className="sidebar-detect"
            onClick={detectProviders}
            disabled={detectingProviders}
          >
            {detectingProviders ? "检测中" : "检测 Agent"}
          </button>
          {providerDetectionError && (
            <span className="sidebar-status-error" role="alert">
              {providerDetectionError}
            </span>
          )}
          <div className="side-status-row">
            <span className="side-status-label">模型</span>
            <span className="side-status-val sidebar-status-value">GLM-4.7</span>
          </div>
          <span>本地工作区</span>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            {activeTab.kind === "chat" &&
              activeTab.scope === "project" &&
              projectName !== "未选择项目" && (
                <>
                  <span className="topbar-project">{projectName}</span>
                  <span className="topbar-sep">/</span>
                </>
              )}
            <span className="topbar-name">{activeTitle}</span>
            <span className="topbar-meta">
              {activeTab.kind === "chat"
                ? `${activeStats.rounds} 轮对话 · 约 ${activeStats.tokens.toLocaleString()} tokens`
                : "编辑器"}
            </span>
          </div>
          <div className="topbar-actions">
            {activeTab.kind === "chat" && (
              <select
                className="topbar-provider"
                aria-label="选择 Agent"
                value={activeProvider}
                onChange={(event) => changeProvider(event.target.value)}
              >
                {["claude", "cursor", "codex", "pi", "opencode"].map((id) => (
                  <option key={id} value={id}>
                    {providerLabel(id)}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="theme-toggle"
              aria-label={theme === "dark" ? "切换浅色主题" : "切换深色主题"}
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
            </button>
            <button
              type="button"
              className="topbar-clear"
              title="清空当前会话"
              onClick={() => {
                if (activeTab.kind === "chat")
                  window.dispatchEvent(
                    new CustomEvent("codeagent:clear-session", {
                      detail: { sessionId: activeTab.sessionId },
                    }),
                  );
              }}
              disabled={activeTab.kind !== "chat"}
            >
              <IconTrash size={15} />
              <span>清空</span>
            </button>
          </div>
        </header>
        <div className="chat-tabs" role="tablist" aria-label="打开的标签">
          {tabs.length === 0 && (
            <span className="chat-tabs-empty">
              没有打开的会话，可从左侧选择或新建
            </span>
          )}
          {tabs.map((tab) => (
            <button
              className={`chat-tab${isSameTab(activeTab, tab) ? " is-active" : ""}`}
              key={
                tab.kind === "chat"
                  ? tab.sessionId
                  : `${tab.projectId}:${tab.path}`
              }
              role="tab"
              aria-label={tabName(tab)}
              title={
                tab.kind === "chat" && tab.scope === "project"
                  ? `${projectName} / ${tabName(tab)}`
                  : tabName(tab)
              }
              aria-selected={isSameTab(activeTab, tab)}
              onClick={() => setActiveTab(tab)}
            >
              {tab.kind === "file" && (
                <IconFile size={13} className="tab-kind-icon" />
              )}
              {tab.kind === "chat" && tab.scope === "project" && (
                <span className="chat-tab-dot" />
              )}
              <span className="chat-tab-title">{tabName(tab)}</span>
              <span
                role="button"
                tabIndex={0}
                className="tab-close chat-tab-close"
                aria-label={`关闭 ${tabName(tab)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeTab(tab);
                  }
                }}
              >
                <IconX size={12} />
              </span>
            </button>
          ))}
        </div>
        {activeTab.kind === "chat" ? (
          <section role="tabpanel" aria-label="聊天">
            <ChatPanel
              sessionId={activeTab.sessionId}
              scope={activeTab.scope}
              projectName={
                activeTab.scope === "project" ? projectName : undefined
              }
              providerName={providerLabel(activeProvider)}
              onProviderChange={changeProvider}
              onStatsChange={setActiveStats}
              disabledProviders={providerStatuses
                .filter((status) => !status.installed)
                .map((status) => providerLabel(status.provider))}
              loadMessages={async () => {
                const load = (
                  window as Window & {
                    codeagentSessions?: {
                      messages: (id: string) => Promise<
                        Array<{
                          id: string;
                          role: "user" | "agent" | "tool";
                          content: unknown;
                          status?: "done" | "streaming" | "error";
                          createdAt?: number;
                          branch?: { index: number; total: number };
                        }>
                      >;
                    };
                  }
                ).codeagentSessions?.messages;
                if (!load) return [];
                return (await load(activeTab.sessionId)).map((message) => ({
                  id: message.id,
                  role: message.role,
                  content:
                    typeof message.content === "string"
                      ? message.content
                      : JSON.stringify(message.content),
                  status: message.status ?? "done",
                  createdAt: message.createdAt,
                  branch: message.branch,
                }));
              }}
              subscribe={(listener) =>
                (
                  window as Window & {
                    codeagentAgent?: {
                      subscribe: (
                        handler: (event: unknown) => void,
                      ) => () => void;
                    };
                  }
                ).codeagentAgent?.subscribe((event) => listener(event as never))
              }
              onAbort={(sessionId) =>
                (
                  window as Window & {
                    codeagentAgent?: {
                      abort: (id: string) => Promise<unknown>;
                    };
                  }
                ).codeagentAgent?.abort(sessionId)
              }
              onPrompt={(text, provider) => {
                const id = providerId(provider);
                const scope = activeTab.scope;
                const prompt = (
                  window as Window & {
                    codeagentAgent?: {
                      prompt: (input: unknown) => Promise<void>;
                    };
                  }
                ).codeagentAgent?.prompt;
                if (!prompt)
                  return Promise.reject(
                    new Error("Agent 接口不可用，请重启应用"),
                  );
                return prompt({
                  sessionId: activeTab.sessionId,
                  provider: id,
                  scope,
                  ...(scope === "project" ? { projectId, projectRoot } : {}),
                  text,
                });
              }}
            />
          </section>
        ) : (
          <section role="tabpanel" aria-label={tabName(activeTab)}>
            <EditorTab
              key={`${activeTab.projectId}:${activeTab.path}`}
              projectId={activeTab.projectId}
              path={activeTab.path}
              content={
                fileContents[`${activeTab.projectId}:${activeTab.path}`] ??
                "# CodeAgent Studio\n"
              }
              useMonaco={typeof window.matchMedia === "function"}
              onDirtyChange={(dirty) =>
                setTabs((items) =>
                  items.map((item) =>
                    item.kind === "file" &&
                    item.projectId === activeTab.projectId &&
                    item.path === activeTab.path
                      ? { ...item, dirty }
                      : item,
                  ),
                )
              }
              onSave={(content) => {
                setFileContents((current) => ({
                  ...current,
                  [`${activeTab.projectId}:${activeTab.path}`]: content,
                }));
                const write = (
                  window as Window & {
                    codeagent?: {
                      workspace?: {
                        write: (
                          projectId: string,
                          path: string,
                          value: string,
                        ) => Promise<unknown>;
                      };
                    };
                  }
                ).codeagent?.workspace?.write;
                if (write)
                  return write(activeTab.projectId, activeTab.path, content)
                    .then(() => {
                      setTabs((items) =>
                        items.map((item) =>
                          item.kind === "file" &&
                          item.projectId === activeTab.projectId &&
                          item.path === activeTab.path
                            ? { ...item, dirty: false }
                            : item,
                        ),
                      );
                    })
                    .catch((error: unknown) => {
                      throw error instanceof Error
                        ? error
                        : new Error("文件保存失败");
                    });
              }}
            />
          </section>
        )}
      </main>
    </div>
  );
}
