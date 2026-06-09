import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Image,
  Music,
  Refresh,
  Video,
} from "../../assets/icons";

type ArtifactKind = "text" | "image" | "video" | "audio" | "pdf" | "binary";

interface ArtifactBucket {
  id: string;
  label: string;
  description: string;
  roots: string[];
  fileCount: number;
  mtime: number;
}

interface ArtifactFile {
  name: string;
  relPath: string;
  bytes: number;
  mtime: number;
  kind: ArtifactKind;
  isText: boolean;
}

interface ArtifactTextPreview {
  content: string;
  bytes: number;
  truncated: boolean;
}

interface OpenArtifact {
  file: ArtifactFile;
  text?: ArtifactTextPreview | null;
  dataUrl?: string | null;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAgo(ms: number): string {
  if (!ms) return "empty";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function kindIcon(kind: ArtifactKind): React.JSX.Element {
  if (kind === "image") return <Image size={14} />;
  if (kind === "video") return <Video size={14} />;
  if (kind === "audio") return <Music size={14} />;
  return <FileText size={14} />;
}

function Artifacts({ profile }: { profile?: string }): React.JSX.Element {
  const [buckets, setBuckets] = useState<ArtifactBucket[]>([]);
  const [selectedBucketId, setSelectedBucketId] = useState<string>("");
  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const [openArtifact, setOpenArtifact] = useState<OpenArtifact | null>(null);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState("");

  const selectedBucket = useMemo(
    () => buckets.find((bucket) => bucket.id === selectedBucketId) || null,
    [buckets, selectedBucketId],
  );

  const loadBuckets = useCallback(async () => {
    setLoadingBuckets(true);
    setError("");
    try {
      const next = await window.hermesAPI.listArtifactBuckets(profile);
      setBuckets(next);
      setSelectedBucketId((current) => {
        if (current && next.some((bucket) => bucket.id === current)) return current;
        return next.find((bucket) => bucket.fileCount > 0)?.id || next[0]?.id || "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBuckets(false);
    }
  }, [profile]);

  const loadFiles = useCallback(async () => {
    if (!selectedBucketId) {
      setFiles([]);
      return;
    }
    setLoadingFiles(true);
    setError("");
    try {
      setFiles(await window.hermesAPI.listArtifactFiles(selectedBucketId, profile));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [profile, selectedBucketId]);

  const openFile = useCallback(
    async (file: ArtifactFile) => {
      if (!selectedBucketId) return;
      setLoadingPreview(true);
      setOpenArtifact({ file });
      try {
        if (file.kind === "text") {
          const text = await window.hermesAPI.readArtifactText(
            selectedBucketId,
            file.relPath,
            profile,
          );
          setOpenArtifact({ file, text, error: text ? undefined : "Could not load text preview." });
        } else if (["image", "video", "audio", "pdf"].includes(file.kind)) {
          const dataUrl = await window.hermesAPI.readArtifactDataUrl(
            selectedBucketId,
            file.relPath,
            profile,
          );
          setOpenArtifact({
            file,
            dataUrl,
            error: dataUrl ? undefined : "Preview is unavailable for this file.",
          });
        } else {
          setOpenArtifact({ file });
        }
      } catch (err) {
        setOpenArtifact({
          file,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoadingPreview(false);
      }
    },
    [profile, selectedBucketId],
  );

  const revealOpenFile = useCallback(async () => {
    if (!selectedBucketId || !openArtifact) return;
    await window.hermesAPI.showArtifactInFolder(
      selectedBucketId,
      openArtifact.file.relPath,
      profile,
    );
  }, [openArtifact, profile, selectedBucketId]);

  useEffect(() => {
    void loadBuckets();
  }, [loadBuckets]);

  useEffect(() => {
    void loadFiles();
    setOpenArtifact(null);
  }, [loadFiles]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadBuckets();
      void loadFiles();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadBuckets, loadFiles]);

  return (
    <div className="artifacts-container">
      <header className="artifacts-header">
        <div>
          <div className="artifacts-kicker">Hermes outputs</div>
          <h1 className="artifacts-title">Artifacts</h1>
          <p className="artifacts-subtitle">
            Browse generated apps, goals, media, sandboxes, and profile workspace files.
          </p>
        </div>
        <button className="btn-ghost artifacts-refresh" onClick={loadBuckets}>
          <Refresh size={14} className={loadingBuckets ? "spin" : ""} />
          Refresh
        </button>
      </header>

      {error && <div className="artifacts-error">{error}</div>}

      <div className="artifacts-shell">
        <aside className="artifacts-buckets">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              className={`artifacts-bucket${bucket.id === selectedBucketId ? " active" : ""}`}
              onClick={() => setSelectedBucketId(bucket.id)}
              type="button"
            >
              <span className="artifacts-bucket-icon">
                <FolderOpen size={15} />
              </span>
              <span>
                <strong>{bucket.label}</strong>
                <small>{bucket.description}</small>
              </span>
              <em>{bucket.fileCount}</em>
            </button>
          ))}
          {!loadingBuckets && buckets.length === 0 && (
            <div className="artifacts-empty">No artifact roots found.</div>
          )}
        </aside>

        <section className="artifacts-files">
          <div className="artifacts-section-head">
            <div>
              <strong>{selectedBucket?.label || "Files"}</strong>
              <span>{selectedBucket ? formatAgo(selectedBucket.mtime) : "Pick a bucket"}</span>
            </div>
            <small>{selectedBucket?.roots.join(" · ") || ""}</small>
          </div>

          <div className="artifacts-file-list">
            {loadingFiles ? (
              <div className="artifacts-empty">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="artifacts-empty">
                This bucket is empty. Run Hermes and generated outputs will appear here.
              </div>
            ) : (
              files.map((file) => (
                <button
                  key={file.relPath}
                  className={`artifacts-file${openArtifact?.file.relPath === file.relPath ? " active" : ""}`}
                  onClick={() => void openFile(file)}
                  type="button"
                >
                  <span className={`artifacts-kind artifacts-kind-${file.kind}`}>
                    {kindIcon(file.kind)}
                  </span>
                  <span>
                    <strong>{file.relPath}</strong>
                    <small>
                      {file.kind} · {formatBytes(file.bytes)} · {formatAgo(file.mtime)}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="artifacts-preview">
          {openArtifact ? (
            <>
              <div className="artifacts-preview-head">
                <div>
                  <strong>{openArtifact.file.name}</strong>
                  <span>{openArtifact.file.relPath}</span>
                </div>
                <button className="btn-ghost artifacts-reveal" onClick={revealOpenFile}>
                  <ExternalLink size={13} />
                  Reveal
                </button>
              </div>
              <div className="artifacts-preview-body">
                {loadingPreview && <div className="artifacts-empty">Loading preview...</div>}
                {!loadingPreview && openArtifact.error && (
                  <div className="artifacts-empty">{openArtifact.error}</div>
                )}
                {!loadingPreview && openArtifact.file.kind === "text" && openArtifact.text && (
                  <pre className="artifacts-text-preview">
                    {openArtifact.text.content}
                    {openArtifact.text.truncated ? "\n\n[Preview truncated]" : ""}
                  </pre>
                )}
                {!loadingPreview && openArtifact.file.kind === "image" && openArtifact.dataUrl && (
                  <img
                    className="artifacts-image-preview"
                    src={openArtifact.dataUrl}
                    alt={openArtifact.file.name}
                  />
                )}
                {!loadingPreview && openArtifact.file.kind === "video" && openArtifact.dataUrl && (
                  <video className="artifacts-media-preview" src={openArtifact.dataUrl} controls />
                )}
                {!loadingPreview && openArtifact.file.kind === "audio" && openArtifact.dataUrl && (
                  <div className="artifacts-audio-wrap">
                    <Music size={24} />
                    <audio src={openArtifact.dataUrl} controls />
                  </div>
                )}
                {!loadingPreview && openArtifact.file.kind === "pdf" && openArtifact.dataUrl && (
                  <iframe
                    className="artifacts-pdf-preview"
                    src={openArtifact.dataUrl}
                    title={openArtifact.file.name}
                  />
                )}
                {!loadingPreview && openArtifact.file.kind === "binary" && (
                  <div className="artifacts-empty">
                    <Download size={18} />
                    Binary preview is unavailable. Use Reveal to open it in Finder.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="artifacts-preview-placeholder">
              <FolderOpen size={28} />
              <strong>Select a file</strong>
              <span>Text, media, HTML, PDF, and generated app files preview here.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Artifacts;
