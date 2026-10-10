import { AnimatePresence, motion } from "framer-motion";
import { Image as ImageIcon, MapPin, Plus, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";

/** Images only, and a panorama can be heavy, so the ceiling is generous. */
const MAX_SIZE = 25 * 1024 * 1024;

const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

/** What the landing screen hands over to start an analysis. */
export type PanoramaInput = {
  file: File;
  /** A URL of its own, so the analysing screen can keep showing the panorama. */
  previewUrl: string;
  name: string;
};

export type UploadZoneProps = {
  className?: string;
  onAnalyze?: (input: PanoramaInput) => void;
};

export function UploadZone({ className, onAnalyze }: UploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One object URL per chosen file, revoked as soon as it is replaced or removed.
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      setError(describeRejection(rejections[0]));
      return;
    }

    const next = accepted[0];
    if (!next) return;

    setError(null);
    setFile(next);
  }, []);

  const filled = file !== null;

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    multiple: false,
    // Once a panorama is in, the zone becomes a preview: clicks belong to it.
    noClick: filled,
    noKeyboard: filled,
  });

  // A new drag is a new attempt: clear the previous complaint straight away.
  useEffect(() => {
    if (isDragActive) setError(null);
  }, [isDragActive]);

  const remove = () => {
    setFile(null);
    setError(null);
  };

  const findLocation = () => {
    if (!onAnalyze || !file) return;

    // A URL of its own, deliberately not the one this component revokes on
    // unmount, so the analysing screen can still show the panorama. `App` owns
    // this one and revokes it when the demo resets.
    onAnalyze({ file, previewUrl: URL.createObjectURL(file), name: file.name });
  };

  const name = file?.name ?? "";
  const meta = file ? `${formatBytes(file.size)} · Panorama ready` : "";

  const rootProps = getRootProps();

  return (
    <div className={cn("w-full", className)}>
      <div
        {...rootProps}
        onKeyDown={(event) => {
          rootProps.onKeyDown?.(event);
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        }}
        className={cn(
          "group relative flex min-h-[178px] w-full items-center justify-center rounded-lg border border-dashed px-8 py-8",
          // `scale` is listed by name: Tailwind v4 sets it as its own property.
          "transition-[scale,box-shadow,background-color,border-color] duration-300 ease-out",
          "focus-visible:ring-2 focus-visible:ring-lime/40",
          // Empty: a quiet technical edge that lights up lime on drag-over.
          !filled && "dropzone-idle cursor-pointer border-white/15",
          !filled && !isDragActive && "hover:border-white/25 hover:bg-white/[0.03]",
          isDragActive && "dropzone-active scale-[1.015] border-lime/70",
          isDragReject && "border-es/70 bg-es/[0.06]",
          // A rejected file holds the edge in the amber warning colour.
          error !== null && !filled && "border-es/45",
          filled && "border-solid border-white/10 bg-white/[0.03]",
        )}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait" initial={false}>
          {!filled ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-none flex flex-col items-center gap-5 text-center"
            >
              <div className="relative">
                <div className="grid size-16 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
                  <Upload
                    className="size-7 text-mist/75 transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
                    strokeWidth={1.6}
                  />
                </div>
                <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-md bg-lime text-ink ring-2 ring-ink">
                  <Plus className="size-3.5" strokeWidth={3} />
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="font-display text-[17px] font-medium text-mist">Upload image</p>
                <p className="text-[12px] text-white/40">
                  Drag &amp; drop or click · JPG, PNG, WEBP
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full items-center gap-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40">
                {objectUrl ? (
                  <img src={objectUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center">
                    <ImageIcon className="size-5 text-white/30" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-mist">{name}</p>
                <p className="mt-1.5 text-[12px] text-white/40">{meta}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={remove}>
                  <X className="size-3.5" />
                  Remove
                </Button>

                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
                  <Button type="button" size="lg" onClick={findLocation}>
                    <MapPin className="size-4" />
                    Find my location
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error !== null && (
          <motion.p
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 flex items-center gap-2.5 rounded-lg border border-es/20 bg-es/[0.08] px-3.5 py-2.5 text-[13px] text-amber-200/90"
          >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-es" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Friendly, human copy for the rejections react-dropzone can report. */
function describeRejection(rejection: FileRejection | undefined) {
  const code = rejection?.errors[0]?.code;
  const name = rejection?.file.name ?? "That file";

  switch (code) {
    case "file-too-large":
      return `${name} is over 25 MB. Try a lighter export of the panorama.`;
    case "file-too-small":
      return `${name} looks empty. Try another panorama.`;
    case "too-many-files":
      return "One panorama at a time, please.";
    case "file-invalid-type":
      return "That file type isn't supported. Use a JPG, PNG or WEBP panorama.";
    default:
      return "We couldn't read that file. Try another image.";
  }
}
