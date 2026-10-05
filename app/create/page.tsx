"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function CreatePostPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  }

  function removePhoto() {
    setFile(null);
    setPreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    // Upload image
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(fileName, file);

    if (uploadError) {
      alert("Upload failed");
      setLoading(false);
      return;
    }

    const { data } = supabase.storage.from("photos").getPublicUrl(fileName);

    // Save post
    await supabase.from("posts").insert({
      user_id: user.id,
      caption,
      image_url: data.publicUrl,
    });

    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6">
      <h1 className="text-3xl font-bold mb-6">Create New Post</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo Preview Area */}
        <div className="border-2 border-dashed border-foreground/20 rounded-xl p-4 text-center">
          {preview ? (
            <div className="relative">
              <Image
                src={preview}
                alt="Preview"
                width={400}
                height={400}
                className="w-full h-auto rounded-lg object-cover max-h-96"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-black/70 text-white px-3 py-1 rounded text-sm"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="py-12">
              <p className="mb-4 text-foreground/60">Select a photo</p>
              <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg inline-block">
                Choose Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  required
                />
              </label>
            </div>
          )}
        </div>

        {/* Caption */}
        <div>
          <label className="block text-sm font-medium mb-1">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 bg-background"
            placeholder="Write a caption..."
          />
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </form>
    </div>
  );
}