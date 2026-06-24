/**
 * `MessageInput` — caixa de composição de mensagem.
 *
 * Textarea (auto-cresce até um limite) + botão enviar. Enter envia,
 * Shift+Enter quebra linha. Atualização **otimista**: a mensagem aparece na
 * thread imediatamente; em caso de erro, faz rollback e mostra a mensagem.
 * Após sucesso, invalida as queries de mensagens e de conversas.
 *
 * Usa apenas tokens do design system.
 */
"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, SendHorizontal, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { sendMessage, sendMessageImage } from "./api";
import { conversationsKey } from "./conversation-list";
import { messagesKey } from "./message-thread";
import type { ChatMessage } from "./types";
import { chatErrorMessage } from "./utils";

// Nudge anti-desintermediação: detecta tentativa de levar o contato/pagamento
// para fora (telefone com 8+ dígitos, "whats"/"zap", e-mail). Não bloqueia.
const EXTERNAL_CONTACT_RE =
  /(?:\d[\s().-]?){8,}|\b(?:whats|whatsapp|zap+|wpp|telegram|insta|gmail|hotmail|outlook)\b|@\w+\.\w/i;

function mentionsExternalContact(text: string): boolean {
  return EXTERNAL_CONTACT_RE.test(text);
}

interface MessageInputProps {
  conversationId: string;
  /** Id do usuário logado — usado na mensagem otimista. */
  currentUserId: string;
  className?: string;
}

export function MessageInput({
  conversationId,
  currentUserId,
  className,
}: MessageInputProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const showContactWarning = mentionsExternalContact(value);

  const key = messagesKey(conversationId);

  const mutation = useMutation({
    mutationFn: (message: string) => sendMessage(conversationId, message),
    onMutate: async (message: string) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChatMessage[]>(key);

      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        sender_id: currentUserId,
        message,
        created_at: new Date().toISOString(),
        read_at: null,
      };

      queryClient.setQueryData<ChatMessage[]>(key, (old) => [
        ...(old ?? []),
        optimistic,
      ]);

      return { previous };
    },
    onError: (err, _message, context) => {
      // Rollback do otimista.
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
      setError(chatErrorMessage(err, "Não foi possível enviar a mensagem."));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
  });

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reenviar a mesma imagem depois
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingImage(true);
    setError(null);
    try {
      await sendMessageImage(conversationId, file);
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({ queryKey: conversationsKey });
    } catch (err) {
      setError(chatErrorMessage(err, "Não foi possível enviar a imagem."));
    } finally {
      setUploadingImage(false);
    }
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || mutation.isPending) return;
    setValue("");
    // Restaura a altura natural após limpar.
    if (textareaRef.current) textareaRef.current.style.height = "";
    mutation.mutate(trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(event.target.value);
    // Auto-cresce até ~6 linhas.
    const el = event.target;
    el.style.height = "";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className={cn("border-t bg-card p-3", className)}>
      {error && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {showContactWarning && !error ? (
        <p className="mb-2 flex items-start gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-foreground">
          <ShieldAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
            aria-hidden
          />
          <span>
            Combine o serviço e o pagamento aqui no FazTudo. Negociar por fora
            não tem a proteção da plataforma.
          </span>
        </p>
      ) : null}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploadingImage || mutation.isPending}
          aria-label="Anexar imagem"
          className="shrink-0 rounded-xl"
        >
          {uploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
        </Button>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
          aria-label="Mensagem"
          rows={1}
          className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!value.trim() || mutation.isPending}
          aria-label="Enviar mensagem"
          className="shrink-0 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <SendHorizontal className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </form>
    </div>
  );
}
