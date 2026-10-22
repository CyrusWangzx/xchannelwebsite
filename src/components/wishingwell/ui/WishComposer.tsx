/**
 * 许愿池 · 许愿/建议表单
 *
 * 投掷**之后**才弹出：先有动作，再有话要说——比先填表再投更顺。
 * 三件必做的事：
 *   · 10–200 字本地校验 + 实时字数（超了立刻红，不用等服务端）
 *   · 蜜罐字段：视觉隐藏 + aria-hidden + tabIndex=-1，真人根本碰不到它
 *   · 联系方式只做「仅后台可见」的采集，**不在本地留存**
 *
 * 表单本身不做提交，只把数据交出去（提交逻辑在 useWishSubmit），
 * 这样 2D 降级版可以复用同一个表单。
 */
import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Send } from "lucide-react";
import type { WishKind } from "../../../lib/wishTypes";
import { wishingWell as C } from "../../../content";

const MIN_LEN = 10;
const MAX_LEN = 200;

export interface ComposerDraft {
  text: string;
  author: string;
  contact: string;
}

interface WishComposerProps {
  kind: WishKind;
  submitting: boolean;
  error: string | null;
  onSubmit: (draft: ComposerDraft) => void;
  onCancel: () => void;
}

export default function WishComposer({
  kind,
  submitting,
  error,
  onSubmit,
  onCancel,
}: WishComposerProps) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [contact, setContact] = useState("");
  const [touched, setTouched] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uid = useId();

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  const len = text.trim().length;
  const tooShort = touched && len > 0 && len < MIN_LEN;
  const tooLong = len > MAX_LEN;
  const invalid = len < MIN_LEN || tooLong;

  const submit = () => {
    setTouched(true);
    if (invalid || submitting) return;
    onSubmit({ text: text.trim(), author: author.trim(), contact: contact.trim() });
  };

  return (
    <form
      className="glass-liquid rounded-card p-5 text-left shadow-elevated"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-h4">
        {kind === "coin" ? C.composer.titleCoin : C.composer.titleBottle}
      </p>

      {/* 正文 */}
      <div className="mt-4">
        <label
          htmlFor={`${uid}-text`}
          className="flex items-center justify-between text-caption text-muted"
        >
          <span>{C.composer.textLabel}</span>
          <span
            className={`font-mono tabular-nums ${
              tooLong ? "text-brand-red" : "text-muted"
            }`}
            aria-live="polite"
          >
            {len}/{MAX_LEN}
          </span>
        </label>
        <textarea
          ref={textareaRef}
          id={`${uid}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={4}
          maxLength={MAX_LEN + 40}
          placeholder={
            kind === "coin"
              ? C.composer.textPlaceholderCoin
              : C.composer.textPlaceholderBottle
          }
          aria-invalid={invalid && touched}
          aria-describedby={`${uid}-hint`}
          className="mt-2 w-full resize-none rounded-card border border-hairline bg-surface/50 px-3.5 py-2.5 text-sm leading-relaxed text-text transition duration-fast ease-ease placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
        />
        <p id={`${uid}-hint`} className="sr-only">
          {kind === "coin"
            ? C.composer.textPlaceholderCoin
            : C.composer.textPlaceholderBottle}
        </p>
        {tooShort && (
          <p className="mt-1.5 flex items-center gap-1.5 text-caption text-brand-red">
            <AlertCircle size={12} strokeWidth={2.2} aria-hidden="true" />
            {C.composer.errors.tooShort}
          </p>
        )}
        {tooLong && (
          <p className="mt-1.5 flex items-center gap-1.5 text-caption text-brand-red">
            <AlertCircle size={12} strokeWidth={2.2} aria-hidden="true" />
            {C.composer.errors.tooLong}
          </p>
        )}
      </div>

      {/* 昵称 + 联系方式 */}
      <div className="mt-4 grid gap-3 xs:grid-cols-2">
        <div>
          <label
            htmlFor={`${uid}-author`}
            className="text-caption text-muted"
          >
            {C.composer.authorLabel}
          </label>
          <input
            id={`${uid}-author`}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={16}
            placeholder={C.composer.authorPlaceholder}
            className="mt-2 w-full rounded-card border border-hairline bg-surface/50 px-3.5 py-2 text-sm text-text transition duration-fast ease-ease placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`${uid}-contact`}
            className="text-caption text-muted"
          >
            {C.composer.contactLabel}
          </label>
          <input
            id={`${uid}-contact`}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={64}
            placeholder={C.composer.contactPlaceholder}
            aria-describedby={`${uid}-contact-hint`}
            className="mt-2 w-full rounded-card border border-hairline bg-surface/50 px-3.5 py-2 text-sm text-text transition duration-fast ease-ease placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
          />
          <p id={`${uid}-contact-hint`} className="mt-1.5 text-caption text-muted/80">
            {C.composer.contactHint}
          </p>
        </div>
      </div>

      {/* 蜜罐：肉眼与读屏都碰不到，只有脚本会填 */}
      <div aria-hidden="true" className="pointer-events-none h-0 overflow-hidden">
        <label htmlFor={`${uid}-trap`}>Website</label>
        <input id={`${uid}-trap`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p
          className="mt-3 rounded-card border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-caption text-brand-red"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <button
          type="button"
          className="btn-reset rounded-pill px-4 py-2 text-sm text-muted transition duration-fast ease-ease hover:bg-surface/60 hover:text-text"
          onClick={onCancel}
        >
          {C.composer.cancel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-pill bg-accent-strong px-5 py-2.5 text-sm font-medium text-white transition duration-fast ease-ease hover:shadow-glow disabled:opacity-60"
        >
          <Send size={15} strokeWidth={2} aria-hidden="true" />
          {submitting ? C.composer.submitting : C.composer.submit}
        </button>
      </div>

      <p className="mt-3 text-caption text-muted/80">{C.ghostNotice}</p>
    </form>
  );
}
