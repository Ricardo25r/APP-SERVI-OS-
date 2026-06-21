/**
 * Wrapper server da rota dinâmica (export estático). `generateStaticParams`
 * gera 1 path placeholder (o export exige ≥1); os ids reais são resolvidos no
 * cliente (`useParams`) via SPA. O conteúdo fica em `./view` (client).
 */
import View from "./view";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <View />;
}
