import { useState, useEffect, useRef, useCallback } from "react";
import { SETTINGS_SECTIONS, PROVIDERS } from "../../constants";
import { useI18n } from "../../components/useI18n";

type FallbackProvider = { provider: string; model: string; baseUrl?: string };

function defaultFallbackModel(provider: string): string {
  if (provider === "google-gemini-cli") return "gemini-3.1-pro-preview";
  if (provider === "gemini" || provider === "google")
    return "gemini-3-flash-preview";
  return "";
}

function Providers({
  profile,
  visible,
}: {
  profile?: string;
  visible?: boolean;
}): React.JSX.Element {
  const { t } = useI18n();

  // Env / API keys
  const [env, setEnv] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // Model config
  const [modelProvider, setModelProvider] = useState("auto");
  const [modelName, setModelName] = useState("");
  const [modelBaseUrl, setModelBaseUrl] = useState("");
  const [modelSaved, setModelSaved] = useState(false);
  const modelLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback model chain
  const [fallbacks, setFallbacks] = useState<FallbackProvider[]>([]);
  const [fallbackSaved, setFallbackSaved] = useState(false);
  const fallbackLoaded = useRef(false);
  const fallbackSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Credential pool
  const [credPool, setCredPool] = useState<
    Record<string, Array<{ key: string; label: string }>>
  >({});
  const [poolProvider, setPoolProvider] = useState("");
  const [poolNewKey, setPoolNewKey] = useState("");
  const [poolNewLabel, setPoolNewLabel] = useState("");

  const loadConfig = useCallback(async (): Promise<void> => {
    const [envData, mc, pool, fallbacks] = await Promise.all([
      window.hermesAPI.getEnv(profile),
      window.hermesAPI.getModelConfig(profile),
      window.hermesAPI.getCredentialPool(),
      window.hermesAPI.getFallbackProviders(profile),
    ]);
    setEnv(envData);
    setModelProvider(mc.provider);
    setModelName(mc.model);
    setModelBaseUrl(mc.baseUrl);
    setCredPool(pool);
    setFallbacks(fallbacks);

    requestAnimationFrame(() => {
      modelLoaded.current = true;
      fallbackLoaded.current = true;
    });
  }, [profile]);

  useEffect(() => {
    modelLoaded.current = false;
    fallbackLoaded.current = false;
    loadConfig();
  }, [loadConfig]);

  // Refresh model config when the screen becomes visible
  useEffect(() => {
    if (!visible) return;
    (async (): Promise<void> => {
      const [mc, fallbacks] = await Promise.all([
        window.hermesAPI.getModelConfig(profile),
        window.hermesAPI.getFallbackProviders(profile),
      ]);
      modelLoaded.current = false;
      fallbackLoaded.current = false;
      setModelProvider(mc.provider);
      setModelName(mc.model);
      setModelBaseUrl(mc.baseUrl);
      setFallbacks(fallbacks);
      requestAnimationFrame(() => {
        modelLoaded.current = true;
        fallbackLoaded.current = true;
      });
    })();
  }, [visible, profile]);

  // Auto-save model config when values change (debounced)
  const saveModelConfig = useCallback(async () => {
    if (!modelLoaded.current) return;
    await window.hermesAPI.setModelConfig(
      modelProvider,
      modelName,
      modelBaseUrl,
      profile,
    );
    if (modelName.trim()) {
      const displayName = modelName.split("/").pop() || modelName;
      await window.hermesAPI.addModel(
        displayName,
        modelProvider,
        modelName,
        modelBaseUrl,
      );
    }
    setModelSaved(true);
    setTimeout(() => setModelSaved(false), 2000);
  }, [modelProvider, modelName, modelBaseUrl, profile]);

  useEffect(() => {
    if (!modelLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveModelConfig();
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [modelProvider, modelName, modelBaseUrl, saveModelConfig]);

  const saveFallbackProviders = useCallback(async () => {
    if (!fallbackLoaded.current) return;
    const entries = fallbacks
      .map((entry) => ({
        provider: entry.provider.trim(),
        model: entry.model.trim(),
        baseUrl: entry.baseUrl?.trim() || undefined,
      }))
      .filter((entry) => entry.provider && entry.model);
    await window.hermesAPI.setFallbackProviders(entries, profile);
    setFallbackSaved(true);
    setTimeout(() => setFallbackSaved(false), 2000);
  }, [fallbacks, profile]);

  useEffect(() => {
    if (!fallbackLoaded.current) return;
    if (fallbackSaveTimer.current) clearTimeout(fallbackSaveTimer.current);
    fallbackSaveTimer.current = setTimeout(() => {
      saveFallbackProviders();
    }, 500);
    return () => {
      if (fallbackSaveTimer.current) clearTimeout(fallbackSaveTimer.current);
    };
  }, [fallbacks, saveFallbackProviders]);

  function updateFallback(index: number, patch: Partial<FallbackProvider>): void {
    setFallbacks((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        const next = { ...entry, ...patch };
        if (patch.provider) {
          next.model = defaultFallbackModel(patch.provider) || entry.model;
          if (patch.provider === "custom" && !next.baseUrl) {
            next.baseUrl = "http://localhost:1234/v1";
          }
          if (patch.provider !== "custom") delete next.baseUrl;
        }
        return next;
      }),
    );
  }

  function addFallback(): void {
    setFallbacks((prev) => [
      ...prev,
      { provider: "google-gemini-cli", model: "gemini-3.1-pro-preview" },
    ]);
  }

  function removeFallback(index: number): void {
    setFallbacks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleBlur(key: string): Promise<void> {
    const value = env[key] || "";
    await window.hermesAPI.setEnv(key, value, profile);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  function handleChange(key: string, value: string): void {
    setEnv((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddPoolKey(): Promise<void> {
    if (!poolProvider || !poolNewKey.trim()) return;
    const existing = credPool[poolProvider] || [];
    const entries = [
      ...existing,
      {
        key: poolNewKey.trim(),
        label: poolNewLabel.trim() || `Key ${existing.length + 1}`,
      },
    ];
    await window.hermesAPI.setCredentialPool(poolProvider, entries);
    setCredPool((prev) => ({ ...prev, [poolProvider]: entries }));
    setPoolNewKey("");
    setPoolNewLabel("");
  }

  async function handleRemovePoolKey(
    provider: string,
    index: number,
  ): Promise<void> {
    const entries = [...(credPool[provider] || [])];
    entries.splice(index, 1);
    await window.hermesAPI.setCredentialPool(provider, entries);
    setCredPool((prev) => ({ ...prev, [provider]: entries }));
  }

  function toggleVisibility(key: string): void {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isCustomProvider = modelProvider === "custom";

  return (
    <div className="settings-container">
      <h1 className="settings-header">{t("providers.title")}</h1>
      <p className="models-subtitle" style={{ marginBottom: 16 }}>
        {t("providers.subtitle")}
      </p>

      <div className="settings-section">
        <div className="settings-section-title">
          {t("common.model")}
          {modelSaved && (
            <span className="settings-saved" style={{ marginLeft: 8 }}>
              {t("common.saved")}
            </span>
          )}
        </div>

        <div className="settings-field">
          <label className="settings-field-label">{t("common.provider")}</label>
          <select
            className="input settings-select"
            value={modelProvider}
            onChange={(e) => {
              const v = e.target.value;
              setModelProvider(v);
              if (v === "custom" && !modelBaseUrl) {
                setModelBaseUrl("http://localhost:1234/v1");
              }
            }}
          >
            {PROVIDERS.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
          <div className="settings-field-hint">
            {isCustomProvider
              ? t("settings.customProviderHint")
              : t("settings.providerHint")}
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-field-label">{t("common.model")}</label>
          <input
            className="input"
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder={t("settings.modelNamePlaceholder")}
          />
          <div className="settings-field-hint">{t("settings.modelHint")}</div>
        </div>

        {isCustomProvider && (
          <div className="settings-field">
            <label className="settings-field-label">
              {t("common.baseUrl")}
            </label>
            <input
              className="input"
              type="text"
              value={modelBaseUrl}
              onChange={(e) => setModelBaseUrl(e.target.value)}
              placeholder={t("settings.modelBaseUrlPlaceholder")}
            />
            <div className="settings-field-hint">
              {t("settings.customBaseUrlHint")}
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          {t("settings.sections.fallbackModel")}
          {fallbackSaved && (
            <span className="settings-saved" style={{ marginLeft: 8 }}>
              {t("common.saved")}
            </span>
          )}
        </div>

        <div className="settings-field">
          <div className="settings-field-hint" style={{ marginBottom: 10 }}>
            {t("settings.fallbackHint")}
          </div>
          {fallbacks.length === 0 && (
            <div className="settings-field-hint" style={{ marginBottom: 10 }}>
              {t("settings.noFallback")}
            </div>
          )}
          {fallbacks.map((fallback, index) => (
            <div
              key={`${fallback.provider}-${index}`}
              className="settings-pool-add"
              style={{ marginBottom: 10, alignItems: "flex-start" }}
            >
              <select
                className="input"
                value={fallback.provider}
                onChange={(e) =>
                  updateFallback(index, { provider: e.target.value })
                }
                style={{ width: 170 }}
              >
                {PROVIDERS.options
                  .filter((opt) => opt.value !== "auto")
                  .map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </option>
                  ))}
              </select>
              <input
                className="input"
                type="text"
                value={fallback.model}
                onChange={(e) =>
                  updateFallback(index, { model: e.target.value })
                }
                placeholder={
                  defaultFallbackModel(fallback.provider) ||
                  t("settings.modelNamePlaceholder")
                }
                style={{ flex: 1 }}
              />
              {fallback.provider === "custom" && (
                <input
                  className="input"
                  type="text"
                  value={fallback.baseUrl || ""}
                  onChange={(e) =>
                    updateFallback(index, { baseUrl: e.target.value })
                  }
                  placeholder={t("settings.modelBaseUrlPlaceholder")}
                  style={{ flex: 1 }}
                />
              )}
              <button
                className="btn-ghost"
                style={{ color: "var(--error)", fontSize: 11 }}
                onClick={() => removeFallback(index)}
              >
                {t("settings.remove")}
              </button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addFallback}>
            {t("settings.add")}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          {t("settings.sections.credentialPool")}
        </div>
        <div className="settings-field">
          <div className="settings-field-hint" style={{ marginBottom: 10 }}>
            {t("settings.poolHint")}
          </div>
          <div className="settings-pool-add">
            <select
              className="input"
              value={poolProvider}
              onChange={(e) => setPoolProvider(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="">{t("common.provider")}</option>
              {PROVIDERS.options
                .filter((p) => p.value !== "auto")
                .map((p) => (
                  <option key={p.value} value={p.value}>
                    {t(p.label)}
                  </option>
                ))}
            </select>
            <input
              className="input"
              type="password"
              value={poolNewKey}
              onChange={(e) => setPoolNewKey(e.target.value)}
              placeholder={t("settings.apiKeyPlaceholder")}
              style={{ flex: 1 }}
            />
            <input
              className="input"
              type="text"
              value={poolNewLabel}
              onChange={(e) => setPoolNewLabel(e.target.value)}
              placeholder={t("settings.labelPlaceholder", {
                optional: t("common.optional"),
              })}
              style={{ width: 120 }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddPoolKey}
              disabled={!poolProvider || !poolNewKey.trim()}
            >
              {t("settings.add")}
            </button>
          </div>
          {Object.entries(credPool).map(
            ([provider, entries]) =>
              entries.length > 0 && (
                <div key={provider} className="settings-pool-group">
                  <div className="settings-pool-provider">
                    {PROVIDERS.options.find((p) => p.value === provider)
                      ? t(
                          PROVIDERS.options.find((p) => p.value === provider)!
                            .label,
                        )
                      : provider}
                  </div>
                  {entries.map((entry, idx) => (
                    <div key={idx} className="settings-pool-entry">
                      <span className="settings-pool-label">
                        {entry.label || `${t("settings.keyLabel")} ${idx + 1}`}
                      </span>
                      <span className="settings-pool-key">
                        {entry.key
                          ? `${entry.key.slice(0, 8)}...${entry.key.slice(-4)}`
                          : t("settings.empty")}
                      </span>
                      <button
                        className="btn-ghost"
                        style={{ color: "var(--error)", fontSize: 11 }}
                        onClick={() => handleRemovePoolKey(provider, idx)}
                      >
                        {t("settings.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              ),
          )}
        </div>
      </div>

      {SETTINGS_SECTIONS.map((section) => (
        <div key={section.title} className="settings-section">
          <div className="settings-section-title">{t(section.title)}</div>
          {section.items.map((field) => (
            <div key={field.key} className="settings-field">
              <label className="settings-field-label">
                {t(field.label)}
                {savedKey === field.key && (
                  <span className="settings-saved">{t("common.saved")}</span>
                )}
              </label>
              <div className="settings-input-row">
                <input
                  className="input"
                  type={
                    field.type === "password" && !visibleKeys.has(field.key)
                      ? "password"
                      : "text"
                  }
                  value={env[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  onBlur={() => handleBlur(field.key)}
                  placeholder={t(field.label)}
                />
                {field.type === "password" && (
                  <button
                    className="btn-ghost settings-toggle-btn"
                    onClick={() => toggleVisibility(field.key)}
                  >
                    {visibleKeys.has(field.key)
                      ? t("common.hide")
                      : t("common.show")}
                  </button>
                )}
              </div>
              <div className="settings-field-hint">{t(field.hint)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Providers;
