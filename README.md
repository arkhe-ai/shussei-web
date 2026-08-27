# shussei-web

Cliente web do Shussei — comunicação privada em tempo real (chat efêmero, voz e
compartilhamento de tela) para uma única organização.

Implementa `docs/plans/2026-08-27-shussei-web.md`.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · TanStack Query ·
Socket.IO client · LiveKit client · Motion · Vitest + Testing Library ·
Playwright.

## Rodando

```bash
npm install
cp .env.example .env.local
npm run dev
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | Sobe o cliente em `http://localhost:3000` |
| `npm run build` / `npm start` | Build e execução de produção (`output: standalone`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest + Testing Library |
| `npm run test:e2e` | Playwright (precisa de `npx playwright install chromium` uma vez) |

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Base da `shussei-api`, sem barra no final. Padrão de dev: `http://localhost:3001` |
| `NEXT_PUBLIC_MOCK` | `1` liga o modo mock (veja abaixo). Nunca use em produção |

> `NEXT_PUBLIC_*` é inlinado no bundle **em tempo de build**. No Docker isso
> significa passar como `--build-arg`, não só como env de runtime — o
> `Dockerfile` já expõe os dois ARGs.

### Modo mock

Com `NEXT_PUBLIC_MOCK=1` o cliente roda inteiro sem backend:

- sessão, canais, presença e buffer de chat falsos (`lib/mock/`);
- transporte Socket.IO simulado, com eco das mensagens enviadas;
- entrar/sair de canal de voz simulado (sem LiveKit);
- compartilhamento de tela usa `getDisplayMedia` de verdade e mostra o preview
  local, o que permite testar a detecção de áudio do sistema sem servidor.

Serve para desenvolver a UI antes da `shussei-api` existir e para o smoke test
do Playwright.

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `↑` / `↓` | Navega entre canais |
| `Enter` | Envia mensagem (canal de texto) ou entra na voz (canal de voz) |
| `M` | Muta/desmuta o microfone |
| `S` | Inicia/para o compartilhamento de tela |

Atalhos são ignorados enquanto o foco está em um campo de texto.

## Contratos consumidos da `shussei-api`

REST:

- `GET /api/v1/auth/me` → `{ user: SessionUser | null }`
- `GET /api/v1/channels` → `{ channels: ChannelDto[] }`
- `GET /api/v1/channels/:channelId/messages` → `{ messages: EphemeralMessage[] }`
- `POST /api/v1/channels/:channelId/voice-token` → `{ token, roomName, wsUrl }`

Socket.IO, namespace `/app`:

- emite `presence.identify`, `chat.send`, `voice.join`, `voice.leave`
- escuta `presence.snapshot`, `presence.changed`, `chat.message`, `chat.recent`

Os DTOs vivem em `lib/types.ts` e espelham o contrato do plano.

## Lacunas de contrato (precisam de decisão do backend)

1. **Diretório de usuários.** `presence.snapshot` só traz `onlineUserIds`, sem
   nomes. O cliente tenta `GET /api/v1/users` → `{ users: SessionUser[] }` e,
   enquanto esse endpoint não existir, cai silenciosamente para exibir o id.
   Ver `hooks/use-directory.ts`.
2. **Redirects do OAuth.** O cliente assume que a API redireciona para
   `${WEB_APP_URL}/channels` no sucesso e `${WEB_APP_URL}/access-denied` quando
   o e-mail não está na allowlist.
3. **Logout.** `lib/auth.ts` aponta para `GET /api/v1/auth/logout`, que ainda
   não está no plano da API.
4. **Identidade no LiveKit.** Para casar participantes da sala com a presença
   do app, o token deve usar `identity = user.id` e `name = user.name`.
5. **Cookie de sessão cross-origin.** Web em `:3000` e API em `:3001` são
   origens distintas: o cookie precisa de `SameSite=None; Secure` em produção
   (ou os dois atrás do mesmo host no Caddy) e o CORS precisa de
   `credentials: true`.

## Desvios em relação ao plano

- O microfone é publicado com `setMicrophoneEnabled(true)` em vez de
  `createLocalAudioTrack` + `publishTrack`, para que mutar/desmutar atue na
  mesma track gerenciada pelo LiveKit.
- Arquivos além dos listados no plano: `components/screen-stage.tsx` (renderiza
  as telas compartilhadas), `components/room-audio.tsx` (sem ele ninguém escuta
  o áudio remoto), `components/ui/*` (primitivos do tema), `lib/mock/*`,
  `hooks/use-directory.ts`, `app/channels/page.tsx`, `Dockerfile`.

## Tema

O visual é um terminal CLI/cyberpunk (âmbar sobre preto, monoespaçado). Todas as
cores, bordas e fontes são tokens em `app/globals.css` (`@theme`) — trocar a
pele do app é editar esse bloco, não os componentes.
