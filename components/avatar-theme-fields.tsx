"use client";

import { useEffect, useMemo, useState } from "react";
import { extractDominantColor } from "@/lib/pfp-color";
import { buildThemeCss, isHexColor } from "@/lib/pfp-theme";
import {
  DEFAULT_ADJUST,
  fadeGradient,
  imageStyle,
  type ImageAdjust,
} from "@/lib/theme-image";

type Source = "none" | "pfp" | "image";

function SliderRow({
  label,
  name,
  min,
  max,
  value,
  suffix,
  onChange,
}: {
  label: string;
  name: string;
  min: number;
  max: number;
  value: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-foreground/50">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

export function AvatarThemeFields({
  avatarUrl,
  themeImageUrl,
  initialSource,
  initialColor,
  initialAdjust,
}: {
  avatarUrl: string | null;
  themeImageUrl: string | null;
  initialSource: Source;
  initialColor: string | null;
  initialAdjust: ImageAdjust;
}) {
  const [source, setSource] = useState<Source>(initialSource);
  const [avatarColor, setAvatarColor] = useState<string>(
    initialSource === "pfp" ? initialColor ?? "" : ""
  );
  const [imageColor, setImageColor] = useState<string>(
    initialSource === "image" ? initialColor ?? "" : ""
  );
  const [imagePreview, setImagePreview] = useState<string | null>(themeImageUrl);
  const [adjust, setAdjust] = useState<ImageAdjust>(initialAdjust);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [newAvatar, setNewAvatar] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState<"avatar" | "image" | null>(null);

  async function readInto(
    src: string,
    set: (c: string) => void,
    which: "avatar" | "image"
  ): Promise<string> {
    setReading(true);
    const c = await extractDominantColor(src);
    if (c) {
      set(c);
      setFailed(null);
    } else {
      set("");
      setFailed(which);
    }
    setReading(false);
    return c ?? "";
  }

  // Read colors from images that are already saved
  useEffect(() => {
    if (avatarUrl && !avatarColor) {
      void readInto(avatarUrl, setAvatarColor, "avatar");
    }
    if (themeImageUrl && !imageColor) {
      void readInto(themeImageUrl, setImageColor, "image");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Free the temporary preview URL when it is replaced or the form closes
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      setNewAvatar(false);
      if (avatarUrl) await readInto(avatarUrl, setAvatarColor, "avatar");
      else setAvatarColor("");
      return;
    }

    setNewAvatar(true);
    setRemoveAvatar(false);

    const objectUrl = URL.createObjectURL(file);
    await readInto(objectUrl, setAvatarColor, "avatar");
    URL.revokeObjectURL(objectUrl);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      setImagePreview(themeImageUrl);
      setAdjust(initialAdjust);
      if (themeImageUrl) await readInto(themeImageUrl, setImageColor, "image");
      else setImageColor("");
      return;
    }

    setRemoveImage(false);
    setAdjust(DEFAULT_ADJUST); // a new image starts centered

    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    const c = await readInto(objectUrl, setImageColor, "image");
    if (c) setSource("image");
  }

  const pfpOk = !!avatarColor && !(removeAvatar && !newAvatar);
  const imageOk = !!imageColor && !removeImage;

  const effectiveSource: Source =
    source === "pfp" && pfpOk
      ? "pfp"
      : source === "image" && imageOk
        ? "image"
        : "none";

  const activeColor =
    effectiveSource === "pfp"
      ? avatarColor
      : effectiveSource === "image"
        ? imageColor
        : "";

  const css = useMemo(
    () =>
      isHexColor(activeColor)
        ? buildThemeCss(activeColor, ".pfp-theme-preview")
        : "",
    [activeColor]
  );

  const options: { value: Source; label: string; hint: string; disabled: boolean }[] =
    [
      {
        value: "none",
        label: "Default theme",
        hint: "Use the normal Danum look.",
        disabled: false,
      },
      {
        value: "pfp",
        label: "From my profile picture",
        hint: "Your profile takes its colors from your picture.",
        disabled: !pfpOk,
      },
      {
        value: "image",
        label: "From an image I upload",
        hint: "Colors come from your image, which also shows as a soft cover at the top of your profile.",
        disabled: !imageOk,
      },
    ];

  const showCover = effectiveSource === "image" && !!imagePreview && !removeImage;

  return (
    <div className="space-y-5">
      {/* Profile picture */}
      <div>
        <label className="block text-sm font-medium mb-1">Profile Picture</label>
        <input
          type="file"
          name="avatar"
          accept="image/*"
          onChange={handleAvatarChange}
          className="w-full"
        />
        <p className="mt-1 text-xs text-foreground/50">Images only, up to 5 MB.</p>
        {avatarUrl && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="remove_avatar"
              checked={removeAvatar}
              onChange={(e) => setRemoveAvatar(e.target.checked)}
            />
            Remove current picture
          </label>
        )}
      </div>

      {/* Profile theme */}
      <div className="rounded-lg border border-foreground/10 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Profile theme</p>
          <p className="text-xs text-foreground/50">
            Optional. Visitors see this on your public profile.
          </p>
        </div>

        <div className="space-y-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 text-sm ${
                o.disabled ? "opacity-50" : ""
              }`}
            >
              <input
                type="radio"
                checked={effectiveSource === o.value}
                onChange={() => setSource(o.value)}
                disabled={o.disabled}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{o.label}</span>
                <span className="block text-xs text-foreground/50">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {/* Theme image upload */}
        <div>
          <label className="block text-sm font-medium mb-1">Theme image</label>
          <input
            type="file"
            name="theme_image"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full"
          />
          <p className="mt-1 text-xs text-foreground/50">
            Images only, up to 5 MB. Wide images work best.
          </p>
          {themeImageUrl && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="remove_theme_image"
                checked={removeImage}
                onChange={(e) => setRemoveImage(e.target.checked)}
              />
              Remove current theme image
            </label>
          )}
        </div>

        {reading && (
          <p className="text-xs text-foreground/50">Reading colors...</p>
        )}
        {failed && (
          <p className="text-xs text-red-600">
            Couldn&apos;t read colors from{" "}
            {failed === "avatar" ? "that profile picture" : "that image"}. Try a
            different one.
          </p>
        )}

        <input type="hidden" name="theme_source" value={effectiveSource} />
        <input type="hidden" name="theme_color" value={activeColor} />

        {isHexColor(activeColor) && (
          <>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="pfp-theme-preview rounded-lg border border-border bg-background p-3">
              {showCover && (
                <div className="relative aspect-[576/176] overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview ?? ""}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={imageStyle(adjust)}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ backgroundImage: fadeGradient(adjust) }}
                  />
                </div>
              )}
              <div className={showCover ? "relative -mt-8 px-2 pb-1" : "px-2 py-1"}>
                <p className="text-xs text-muted-foreground mb-1">Preview</p>
                <p className="font-semibold text-foreground">Your username</p>
                <p className="text-sm text-muted-foreground">
                  This is roughly how your profile will look.
                </p>
                <span className="text-sm text-brand">example.com</span>
                <div
                  className="mt-3 h-2 rounded-full"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, hsl(var(--brand)), transparent)",
                  }}
                />
              </div>
            </div>
          </>
        )}

        {/* Adjust the theme image */}
        {showCover && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Adjust your theme image</p>
              <button
                type="button"
                onClick={() => setAdjust(DEFAULT_ADJUST)}
                className="text-xs text-brand hover:underline"
              >
                Reset
              </button>
            </div>

            <SliderRow
              label="Left ↔ Right"
              name="theme_image_x"
              min={0}
              max={100}
              value={adjust.x}
              suffix="%"
              onChange={(x) => setAdjust((a) => ({ ...a, x }))}
            />
            <SliderRow
              label="Up ↕ Down"
              name="theme_image_y"
              min={0}
              max={100}
              value={adjust.y}
              suffix="%"
              onChange={(y) => setAdjust((a) => ({ ...a, y }))}
            />
            <SliderRow
              label="Zoom"
              name="theme_image_zoom"
              min={100}
              max={250}
              value={adjust.zoom}
              suffix="%"
              onChange={(zoom) => setAdjust((a) => ({ ...a, zoom }))}
            />
            <SliderRow
              label="Blend into background"
              name="theme_image_fade"
              min={0}
              max={100}
              value={adjust.fade}
              suffix="%"
              onChange={(fade) => setAdjust((a) => ({ ...a, fade }))}
            />
            <p className="text-xs text-foreground/50">
              Zoom in and move the sliders to choose which part of the image
              shows. Higher blend makes the image fainter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}