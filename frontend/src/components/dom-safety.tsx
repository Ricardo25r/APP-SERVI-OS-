"use client";

/**
 * Blindagem de DOM contra o crash "Failed to execute 'removeChild'/'insertBefore'
 * on 'Node'".
 *
 * Extensões/recursos de **tradução do navegador** (Google Translate do Chrome) e
 * scripts de terceiros (ex.: Google Identity Services) movem/removem nós do DOM
 * por fora do React. Quando o React tenta reconciliar, dispara `NotFoundError` e
 * a tela fica **branca**. Aqui tornamos `removeChild`/`insertBefore` tolerantes:
 * se o nó-alvo já não é filho do pai esperado, não quebram (no-op seguro). É um
 * workaround consagrado em apps React em produção — no-op no fluxo normal do
 * React (que nunca chama esses métodos com nós inválidos).
 */

declare global {
  interface Node {
    __faztudoDomPatched?: boolean;
  }
}

if (typeof window !== "undefined" && typeof Node !== "undefined") {
  if (!Node.prototype.__faztudoDomPatched) {
    Node.prototype.__faztudoDomPatched = true;

    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(
      this: Node,
      child: T
    ): T {
      if (child.parentNode !== this) return child;
      return originalRemoveChild.call(this, child) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(
      this: Node,
      newNode: T,
      referenceNode: Node | null
    ): T {
      if (referenceNode && referenceNode.parentNode !== this) {
        return originalInsertBefore.call(this, newNode, null) as T;
      }
      return originalInsertBefore.call(this, newNode, referenceNode) as T;
    };
  }
}

export function DomSafety() {
  return null;
}
