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

O `.env.local` fica na **raiz deste repositório** (ao lado do `package.json`) e é
gitignored — cada máquina cria o seu. Depois de copiar, **edite o valor de
`NEXT_PUBLIC_API_BASE_URL`**: o padrão do exemplo é `localhost`, que só serve se
o navegador estiver na mesma máquina do backend. Ver "Variáveis de ambiente".

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
| `NEXT_PUBLIC_API_BASE_URL` | Base da `shussei-api`, sem barra no final. Precisa ser o endereço que o **navegador do usuário** alcança |
| `NEXT_PUBLIC_MOCK` | `1` liga o modo mock (veja abaixo). Nunca use em produção |

Onde colocar, em ordem de precedência (o Next lê todos, do mais específico ao
menos): `.env.local` → `.env.development` / `.env.production` → `.env`. Na
prática: **use `.env.local`** para configuração de máquina, e ele precisa
existir **antes** de rodar `npm run dev` ou `npm run build`.

Duas regras que causam 90% dos problemas:

1. **`NEXT_PUBLIC_*` é congelado no `next build`.** Editar o `.env` depois, ou
   passar a env só em runtime (`environment:` do compose, `export` antes do
   `npm start`), não muda o bundle que já foi para o navegador. Tem que
   rebuildar. No Docker vai como `--build-arg` — o `Dockerfile` já expõe os ARGs.
2. **`localhost` é sempre a máquina de quem acessa.** Se o app é servido em
   `http://100.102.91.4:3000`, a API precisa ser `http://100.102.91.4:3001`, não
   `http://localhost:3001`. A tela de login detecta essa combinação e avisa.

### Modo mock

Com `NEXT_PUBLIC_MOCK=1` o cliente roda inteiro sem backend:

- sessão, canais, presença e buffer de chat falsos (`lib/mock/`);
- transporte Socket.IO simulado, com eco das mensagens enviadas;
- entrar/sair de canal de voz simulado (sem LiveKit);
- **o microfone é pedido de verdade** (`getUserMedia`): o medidor de nível
  mostra a captação real e negar a permissão exercita a mensagem de erro;
- compartilhamento de tela usa `getDisplayMedia` de verdade e mostra o preview
  local, o que permite testar a detecção de áudio do sistema sem servidor;
- o nível de áudio **dos outros participantes é simulado** (senoide por id),
  já que não existe SFU reportando levels. Com backend real esses valores vêm
  do LiveKit.

Serve para desenvolver a UI antes da `shussei-api` existir e para o smoke test
do Playwright.

## Feedback de estado

Tudo que é "está funcionando?" tem indicador visível:

| Onde | O que mostra |
| --- | --- |
| `MicMeter` (painel de voz e dock) | Nível real do microfone em 12 segmentos, com rótulo `captando` / `mudo` / `sem microfone`. Bar parada com o mic aberto = o navegador está captando de outro dispositivo de entrada |
| `LiveDot` | Bolinha: cheia = conectado, piscando = atividade agora (falando, transmitindo, reconectando), vazada = mudo/offline |
| Lista de participantes | Barras de nível por pessoa, chips `mudo` / `transmitindo` e qualidade de rede do LiveKit (`rede ruim` em vermelho) |
| `ScreenStage` | Vídeo ao vivo de cada tela compartilhada com selo `● AO VIVO` piscando |
| Dock de voz | Miniatura ao vivo da sua transmissão + medidor, visível enquanto você navega por outros canais |
| Status bar | Ponto fixo em `conectado`, piscando em `reconectando` |

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

## Sintoma comum: o login com Google aponta para `localhost:3001`

Se o botão "Entrar com Google" leva para `http://localhost:3001/...` em vez do
endereço do servidor, o build rodou **sem** `NEXT_PUBLIC_API_BASE_URL`. O valor
é inlinado durante o `next build`, então defini-lo depois (env de runtime do
compose, `export` antes do `npm start`) não altera o bundle já gerado — é
preciso rebuildar passando a variável:

```bash
NEXT_PUBLIC_API_BASE_URL=http://SEU-IP:3001 npm run build
```

No Docker, como build-arg: `--build-arg NEXT_PUBLIC_API_BASE_URL=...`.

Use o IP/host que o **navegador do usuário** alcança: `localhost` sempre aponta
para a máquina de quem está acessando. A tela de login mostra um aviso vermelho
quando detecta essa situação (`components/config-warning.tsx`).
