"use client";

import { useEffect } from "react";
import { mergeAttributes, Node } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import {
  EditorContent,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { buildTorDocumentHtml, extractTorDocumentValues, type TorDocumentSection } from "@/lib/tor-document";
import { cn } from "@/lib/utils";

type TorDocumentEditorProps = {
  sections: TorDocumentSection[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  className?: string;
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

function TorSectionView(props: { node: { attrs: { label?: string; required?: boolean } } }) {
  return (
    <NodeViewWrapper className="tor-section-node">
      <div className="tor-section-node__label" contentEditable={false}>
        {props.node.attrs.label}
        {props.node.attrs.required ? " *" : ""}
      </div>
      <NodeViewContent className="tor-section-node__body" />
    </NodeViewWrapper>
  );
}

const TorSection = Node.create({
  name: "torSection",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      key: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-section-key") || "",
        renderHTML: (attributes) => ({ "data-section-key": attributes.key }),
      },
      label: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-section-label") || "",
        renderHTML: (attributes) => ({ "data-section-label": attributes.label }),
      },
      placeholder: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-section-placeholder") || "",
        renderHTML: (attributes) => ({ "data-section-placeholder": attributes.placeholder }),
      },
      required: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-section-required") === "true",
        renderHTML: (attributes) => ({ "data-section-required": attributes.required ? "true" : "false" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-tor-section='true']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, { "data-tor-section": "true" }),
      ["div", { "data-tor-section-body": "true" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TorSectionView);
  },
});

export function TorDocumentEditor({ sections, values, onChange, className }: TorDocumentEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      TorSection,
      Underline,
      Highlight.configure({
        multicolor: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Placeholder.configure({
        placeholder: t("site.start_writing_here"),
        includeChildren: true,
      }),
    ],
    content: buildTorDocumentHtml(sections, values),
    editorProps: {
      attributes: {
        class: "tor-document__content",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(extractTorDocumentValues(currentEditor.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;

    const nextContent = buildTorDocumentHtml(sections, values);
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, sections, values]);

  function handleSetLink() {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("site.enter_link_url"), previousUrl || "https://");
    if (url === null) return;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmedUrl }).run();
  }

  return (
    <div className={cn("tor-document overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/90 shadow-sm", className)}>
      <div className="flex flex-wrap gap-1 border-b border-border/70 bg-[linear-gradient(180deg,rgba(254,255,254,0.95),rgba(242,247,240,0.82))] p-2.5">
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
        <ToolbarButton
          label={t("site.underline")}
          active={editor?.isActive("underline")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.strike")}
          active={editor?.isActive("strike")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.highlight")}
          active={editor?.isActive("highlight")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
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
        <ToolbarButton
          label={t("site.blockquote")}
          active={editor?.isActive("blockquote")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.code_block")}
          active={editor?.isActive("codeBlock")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.horizontal_rule")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.link")}
          active={editor?.isActive("link")}
          disabled={!editor}
          onClick={handleSetLink}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.remove_link")}
          disabled={!editor?.isActive("link")}
          onClick={() => editor?.chain().focus().unsetLink().run()}
        >
          <Unlink2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label={t("site.clear_formatting")}
          disabled={!editor}
          onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
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
      <div className="flex items-center justify-between border-b border-border/50 bg-card/70 px-4 py-2.5 text-xs text-muted-foreground">
        <span>{t("site.template_sections")}</span>
        <span>{t("site.document_editor")}</span>
      </div>
      <EditorContent editor={editor} className="tor-document__surface px-5 py-5" />
    </div>
  );
}
