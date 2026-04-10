"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isRichTextEmpty, normalizeRichTextValue } from "@/lib/rich-text";

type RichTextEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ label, active = false, disabled = false, onClick, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      className={cn("h-8 w-8 rounded-lg", active && "shadow-sm")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  className,
  minHeightClassName = "min-h-[11rem]",
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "",
      }),
    ],
    content: normalizeRichTextValue(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: cn("rich-text-editor__content", minHeightClassName),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      onChange(isRichTextEmpty(html) ? "" : html);
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;

    const normalizedValue = normalizeRichTextValue(value);
    if (editor.getHTML() !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={cn("rich-text-editor rounded-[1.25rem] border border-border/70 bg-card/90 shadow-sm", className)}>
      <div className="flex flex-wrap gap-1 border-b border-border/70 bg-muted/20 p-2">
        <ToolbarButton
          label={t("site.paragraph")}
          active={editor?.isActive("paragraph")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.heading_two")}
          active={editor?.isActive("heading", { level: 2 })}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.heading_three")}
          active={editor?.isActive("heading", { level: 3 })}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-8 w-px bg-border/70" />
        <ToolbarButton
          label={t("site.bold")}
          active={editor?.isActive("bold")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.italic")}
          active={editor?.isActive("italic")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-8 w-px bg-border/70" />
        <ToolbarButton
          label={t("site.bullet_list")}
          active={editor?.isActive("bulletList")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.numbered_list")}
          active={editor?.isActive("orderedList")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-8 w-px bg-border/70" />
        <ToolbarButton
          label={t("site.undo")}
          disabled={!editor?.can().chain().focus().undo().run()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.redo")}
          disabled={!editor?.can().chain().focus().redo().run()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="rich-text-editor__surface px-4 py-3" />
    </div>
  );
}
