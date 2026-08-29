# shussei-web

Cliente web do Shussei — comunicação privada em tempo real (chat efêmero, voz e
compartilhamento de tela) para uma única organização.

<img width="1874" height="926" alt="image" src="https://github.com/user-attachments/assets/e08ca9c7-89a4-43e8-a458-396f063b7ebc" />


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
| `NEXT_PUBLIC_MOCK_TRAFFIC` | Só vale com o mock ligado. `0` desliga o tráfego ambiente (padrão: ligado) |
| `API_INTERNAL_URL` | Opcional, lido **só no servidor** pelo proxy de arquivos. Endereço da `shussei-api` a partir do container do Next. Sem valor, cai no `NEXT_PUBLIC_API_BASE_URL` |

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
  do LiveKit;
- **tráfego ambiente**: a cada 9s alguém escreve em um canal de texto aleatório
  e a cada 21s alguém entra ou sai de um canal de voz. Metade da interface só
  reage a *outra pessoa* — badge de não lidas, blip, typewriter na mensagem que
  chega — e sem isso nada disso é testável antes da API existir. Desligue com
  `NEXT_PUBLIC_MOCK_TRAFFIC=0`;
- **transmissões simuladas**: ao entrar na voz, duas telas falsas aparecem no
  palco, pintadas em `<canvas>` e capturadas com `captureStream()`. São tracks de
  vídeo de verdade, então grade, foco, tira de miniaturas, tela cheia e o
  detector de congelamento passam todos pelo caminho real (`lib/mock/mock-screen.ts`).

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
| Sidebar | Contador de não lidas por canal de texto (`[3]`, some ao abrir o canal); o título da aba vira `(3) Shussei` |
| `ScreenStage` | `sem sinal` sobre estática quando a transmissão congela — uma track WebRTC que cai não dispara evento, ela só para de entregar frames |
| Bonecos | A boca abre conforme o nível de voz real e um anel de fósforo cresce em volta; mudo fecha a boca e apaga o anel |
| Faixa de voz | Quem está na sala anda pelo rodapé; quem fala para de andar e o nome aparece |
| Sidebar | Contador de não lidas por canal de texto (`[3]`, some ao abrir); título da aba vira `(3) Shussei` |
| `ScreenStage` | `sem sinal` sobre estática quando a transmissão congela — uma track WebRTC que cai não dispara evento, ela só para de entregar frames |
| Avatares | Foto do Google (em fósforo âmbar) ou iniciais; anel ao redor cresce com o nível de voz real da pessoa |

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `↑` / `↓` | Navega entre canais |
| `Enter` | Envia mensagem (canal de texto) ou entra na voz (canal de voz) |
| `M` | Muta/desmuta o microfone |
| `D` | Ensurdece: para de ouvir todo mundo e fecha seu microfone |
| `S` | Inicia/para o compartilhamento de tela |
| `X` | Sai do canal de voz |
| `espaço` | Fala enquanto segurado — só no modo push-to-talk |
| `F` | Tela cheia das transmissões |
| `G` | Alterna grade e foco (com duas ou mais transmissões) |
| `1`–`9` | Foca a transmissão daquele número |

Atalhos são ignorados enquanto o foco está em um campo de texto.

## Transmissões

O palco tem dois arranjos e uma tela cheia:

| Arranjo | Quando | O que mostra |
| --- | --- | --- |
| Grade | Padrão com duas ou mais telas | Todas lado a lado. O número de colunas vem da **quantidade de telas**, não do breakpoint: duas pessoas transmitindo em um monitor largo ficam com metade da janela cada, e não com dois terços e uma coluna vazia |
| Foco | Ao clicar em uma tela, ou com `G` | Uma grande e a tira de miniaturas numeradas embaixo, como no Discord. `1`–`9` pula direto para uma |
| Tela cheia | `F` | Usa a API de fullscreen do navegador. Onde ela é recusada — dentro de iframe, ou sob permissions policy — cai para um modo teatro (`fixed inset-0`), porque um botão de expandir que silenciosamente não faz nada é pior que um que expande na página |

Quem estava em foco parar de transmitir devolve você para a grade, e a última
tela sair fecha a tela cheia — ninguém fica preso em uma tela cheia vazia.

### Áudio do sistema

Captura e publicação são passos separados, e não um
`setScreenShareEnabled(true, { audio: true })`. Aquela chamada publica vídeo e
áudio juntos: se o SFU recusa a track de áudio, ela leva o compartilhamento
inteiro junto e a sala renegocia — foi o sintoma relatado de "cai a conexão do
LiveKit e reabre" ao compartilhar com áudio, enquanto sem áudio funcionava.

Agora o seletor de tela abre **uma vez**, o vídeo é publicado sempre, e uma falha
ao publicar o áudio é isolada: a imagem continua no ar. Como as tracks passam a
ser publicadas à mão, `stopScreenShare` também despublica as duas à mão.

A captura desce uma escada, da mais capaz para a mais simples:

| Tentativa | Opções | Por quê |
| --- | --- | --- |
| 1 | `{ audio: true, systemAudio: 'include' }` | O que dá áudio do sistema no Chrome |
| 2 | `{ audio: true }` | `systemAudio` é opção **só do Chrome**, e um navegador que não a conhece rejeita a chamada inteira do `getDisplayMedia` — antes do seletor abrir, então descer um degrau não custa nada ao usuário |
| 3 | `{ audio: false }` | Só a imagem, quando áudio é impossível naquela máquina |

Fechar o seletor (`NotAllowedError` / `AbortError`) **interrompe a escada**: seria
péssimo reabrir o seletor logo depois de você tê-lo fechado.

Todo erro vai para o `console.error` e aparece entre parênteses no aviso da UI,
inclusive na falha total. Uma mensagem genérica de "não foi possível iniciar"
não deixa nada para diagnosticar, e é justamente esse o caminho que dispara
quando um compartilhamento falha de vez.

## Bonecos

Cada pessoa é um dos **24 personagens** de `public/sprites/characters.png`. Não há
foto: `avatarUrl` continua no DTO por causa do contrato da API, mas nada
renderiza esse campo.

- **Quem é quem**: o personagem sai de um hash do id do usuário, então é estável
  sem precisar de armazenamento nenhum. Só a **sua** escolha é uma escolha, no
  botão `boneco` da status bar, que abre a grade 6x4 com todos.
- **Pulo**: a altura acompanha o `audioLevel` real, com achatamento na
  aterrissagem. Continua sendo medidor e não indicador binário — é o mesmo
  número que move as barras de nível.
- **Faixa no rodapé**: aparece ao entrar em canal de voz. Todo mundo anda de um
  lado para o outro em ciclos de duração diferente; **quem fala para de andar** e
  ganha o nome em cima. Silêncio é movimento, fala é imobilidade — a inversão é
  o que faz o falante saltar aos olhos numa sala de quarenta.
- **Desenho**: uma folha só, fatiada por `background-position` em porcentagem.
  Uma requisição para os 24, cacheada uma vez, e trocar de personagem é uma
  mudança de estilo em vez de uma imagem nova. A resolução da folha é detalhe do
  script de build; o código só precisa concordar sobre a grade ser 6x4.

### Regerando a folha

A arte fica em `assets/characters-source.png` (fora de `public/`, não é servida).
O script de build corta, tira o fundo e reduz:

```bash
node scripts/build-sprites.mjs
```

Duas coisas que ele resolve e que não são óbvias:

1. **Não existe grade de pixels para encaixar.** A arte é renderizada com
   anti-aliasing e ruído — medindo a periodicidade do gradiente, nada trava. Por
   isso o corte é por conteúdo, não por bloco.
2. **O fundo sai por flood fill a partir das bordas, não por cor.** Uma chave de
   cor abriria buracos no branco do panda, na túnica do clérigo e no pato — o
   branco deles é fechado por contorno escuro.

Todos os 24 são recortados na **mesma** caixa (a união dos conteúdos), então
mantêm o tamanho relativo entre si e pisam na mesma linha de chão. Saída: 288x192,
27KB.

> A folha é colorida e quebra de propósito a regra monocromática do resto da
> pele. Se um dia isso incomodar, um filtro de tint âmbar sobre `Sprite`
> devolve a coerência sem mexer na arte.

## Controles de voz

| Controle | O que faz |
| --- | --- |
| Mutar | Fecha só o seu microfone |
| Ensurdecer | Silencia todo mundo **e** fecha seu microfone. As tracks continuam chegando, então voltar a ouvir é instantâneo |
| Modo `aberto` / `push-to-talk` | No PTT o microfone fica fechado até você segurar espaço. Perder o foco da janela solta o botão, senão o microfone ficaria aberto numa aba que você nem está olhando |
| Dispositivos | Escolhe entrada e saída de áudio. A saída só aparece onde `setSinkId` existe (Chrome/Edge); Firefox e Safari usam sempre o padrão do sistema |
| Volume por participante | Ganho individual, aplicado no `<audio>` de cada feed. Desenhado como `[-] [▮▮▮▮▮░░░░░] [+]` com semântica de slider própria (setas, Home/End, clique na barra) — o `<input type="range"> `nativo era o único controle da tela com polegar arredondado e cor de sistema |

Mudo, ensurdecido e push-to-talk são três motivos independentes para o
microfone estar fechado. Eles são resolvidos em **um** lugar
(`isTransmitting`, em `hooks/use-voice-room.ts`) e um único efeito aplica o
resultado no hardware — nenhum deles escreve no dispositivo por conta própria.

Modo de fala, dispositivos escolhidos e volumes ficam em `localStorage`
(`lib/prefs.ts`), não na sessão: descrevem o hardware **desta máquina**, então
sincronizar com a conta daria a resposta errada em um segundo computador.

## Notificações

O botão `som` na status bar liga/desliga o blip e, na primeira vez que é
ligado, pede permissão de notificação do navegador (o prompt só é aceito dentro
de um gesto do usuário — o clique serve de gesto).

- **Blip**: dois tons quadrados sintetizados na hora (`lib/notify.ts`), sem
  arquivo de áudio — combina com a pele e não pode falhar ao carregar.
- **Mensagem**: toca quando chega em outro canal, ou no canal aberto se a aba
  estiver escondida.
- **Entrar/sair da voz**: só toca para a sala em que **você** está. Avisar de
  toda movimentação da casa seria barulho constante.
- **Notificação de desktop**: só com a aba escondida.

## Arquivos do canal

Cada canal tem um armazenamento durável próprio, em `/channels/:id/arquivos`
— na prática `/channels/:id/files`. Os arquivos sobrevivem ao buffer efêmero:
a mensagem que anunciou um arquivo some em 1h, o arquivo não.

### Por que não é uma página separada

`app/channels/layout.tsx` lê o segmento ativo e troca **só o painel central**
do `AppShell`. A URL é real (dá para linkar, o botão voltar funciona), mas o
shell nunca é remontado — é o mesmo motivo pelo qual o shell mora no layout e
não na página: o App Router remonta a página a cada troca de segmento, e isso
derrubaria a sala do LiveKit. Uma `page.tsx` que renderizasse o navegador de
arquivos mataria a call de quem clicasse em "arquivos".

O dock de voz aparece também quando você está nos arquivos do canal em que
está falando: o painel de voz sai da tela, e sem o dock você ficaria conectado
sem nenhum botão de mutar.

A pasta atual é um parâmetro de query (`?pasta=<id>`), não estado de
componente — uma pasta é um lugar, e um lugar tem que sobreviver a um reload.

### Proxy de leitura

Toda leitura de arquivo passa por `app/files/[fileId]/route.ts`, no mesmo
origin do cliente, nunca direto na API.

```text
<img src="/files/<id>">  →  Next (encaminha o cookie)  →  API /api/v1/files/<id>
```

O motivo é o cookie de sessão, que é `httpOnly; SameSite=Lax`. Com o cliente em
`app.*` e a API em `api.*`, uma `<img>` apontando direto para a API é uma
requisição cross-site: o navegador não manda o cookie e a resposta é 401. **Em
produção apenas** — em `localhost` os dois são same-site e o problema não
aparece, que é justamente o que torna a armadilha cara.

O proxy encaminha `Range` nos dois sentidos (dá para buscar dentro de um vídeo
sem baixar tudo), atende `GET` e `HEAD`, devolve `Content-Type`,
`Content-Length` e `Content-Range`, e preserva 200, 206, 401, 404 e 416.
`API_INTERNAL_URL` cobre o caso do container, onde a API não está no mesmo
endereço que o navegador usa.

**A rota fica em `/files/:id`, fora de `/api`, e isso não é estético.** O proxy
reverso entrega todo o namespace `/api/*` para o backend antes de consultar o
app:

```caddyfile
# shussei-infra/caddy/Caddyfile.dev
@api path /api/*
reverse_proxy @api api:3001
```

Um proxy em `/api/files/:id` nunca chegaria ao Next: o Caddy engole a
requisição e o Nest responde `Cannot GET /api/files/<id>`. Qualquer deploy que
coloque cliente e API atrás de um host só tem o mesmo formato, então a rota
mora fora desse namespace.

### Upload

O corpo do `POST` carrega **só o arquivo**; a pasta de destino vai na query, e
a ausência dela significa a raiz do canal — multipart não tem `null`, e o campo
chegaria como a string `"null"`.

O progresso exige `XMLHttpRequest`, que passa por fora do `apiFetch` — e é no
`apiFetch` que mora a checagem de modo mock. Por isso todo upload entra por
`lib/upload.ts`, que repete a checagem: sem ela, justamente a funcionalidade
feita para rodar sem backend seria a única a bater na rede.

Limites do cliente (`lib/upload.ts`): 25 MB e uma lista de tipos. São para
feedback rápido — a resposta do backend é a que vale, e 413/415 continuam
sendo tratados.

### Anexos no chat

O arquivo é enviado por REST **antes** de ser anunciado. Pelo socket viaja
apenas o id:

```ts
socket.emit('chat.send', { channelId, body, fileIds });
```

Nunca binário, Base64, blob URL ou caminho físico. `fileIds` é omitido em
mensagem sem anexo, então o payload de texto puro é exatamente o que sempre
foi. Uma mensagem só com anexo, sem texto, é válida.

### Modo mock

A feature inteira roda com `NEXT_PUBLIC_MOCK=1` e nenhum backend. As imagens de
mock são data URIs SVG inline — sem host, sem rede. Um arquivo com `falha` no
nome é rejeitado de propósito, para o caminho de retry ser alcançável à mão.
## Contratos consumidos da `shussei-api`

REST:

- `GET /api/v1/auth/me` → `{ user: SessionUser | null }`
- `GET /api/v1/channels` → `{ channels: ChannelDto[] }`
- `GET /api/v1/channels/:channelId/messages` → `{ messages: EphemeralMessage[] }`
- `POST /api/v1/channels/:channelId/voice-token` → `{ token, roomName, wsUrl }`

Arquivos (a raiz do canal viaja como o literal `null`):

- `GET /api/v1/channels/:channelId/folders?parentId=<uuid|null>` → `{ folders: FolderDto[] }`
- `POST /api/v1/channels/:channelId/folders` → `{ folder: FolderDto }`
- `GET /api/v1/folders/:folderId` → `{ folder: FolderDto }`
- `GET /api/v1/folders/:folderId/breadcrumbs` → `{ breadcrumbs: FolderDto[] }`
- `PATCH /api/v1/folders/:folderId` → `{ folder: FolderDto }`
- `DELETE /api/v1/folders/:folderId` → `204`
- `GET /api/v1/channels/:channelId/files?folderId=<uuid|null>` → `{ files: StoredFileDto[] }`
- `POST /api/v1/channels/:channelId/files?folderId=<uuid>` → `{ file: StoredFileDto }` (multipart, só o arquivo)
- `PATCH /api/v1/files/:fileId` → `{ file: StoredFileDto }` (renomear e mover)
- `DELETE /api/v1/files/:fileId` → `204`
- `GET`/`HEAD /api/v1/files/:fileId` → bytes, com `Range`

Socket.IO, namespace `/app`:

- emite `presence.identify`, `chat.send`, `voice.join`, `voice.leave`
- escuta `presence.snapshot`, `presence.changed`, `chat.message`, `chat.recent`

`chat.send` aceita `fileIds?: string[]`; o `chat.message` de volta traz
`attachments?: FileAttachmentDto[]` já resolvidos, e eles precisam sobreviver
ao buffer do Redis para uma mensagem recuperada não perder o anexo.

Os DTOs vivem em `lib/types.ts` e espelham o contrato do plano.

## TODO / backlog do cliente web

Marcados com **[feito]** os que já estão no cliente; a seção correspondente
deste README descreve como ficaram.

### RTC, voz e vídeo

1. **[feito] Corrigir flicker no vídeo transmitido.** O diagnóstico estava certo: `readScreenFeeds`/`readAudioFeeds` montam objetos `MediaFeed` novos a cada evento da sala, e o efeito de attach dependia da identidade do objeto — cada sync detachava e reanexava a track. Corrigido nas duas pontas: `feedsChanged` (`lib/livekit.ts`) impede o estado de mudar quando a lista descreve as mesmas tracks, e os efeitos de attach em `ScreenStage` e `RoomAudio` passaram a ser chaveados por `feed.id`. O áudio tinha o mesmo problema, com falha audível em vez de visível.
2. **[feito] Controles de som.** Volume por participante, aplicado no `<audio>` de cada feed. Ver "Controles de voz".
3. **[feito] Seleção de dispositivos.** Entrada e saída, durante a call, em `[C] Dispositivos`. A saída só aparece onde `setSinkId` existe. Ver "Controles de voz".
4. **Mostrar nome em vez de id na lista de voz.** Chat já usa nome real/personalizado via backend. Falta enviar `name` no token LiveKit e validar nomes dos participantes da call, com fallback para id apenas quando inevitável. **Parte do cliente está pronta**: o fallback para id só acontece quando não há nome, e a lista de presença explica quando o diretório não existe. O envio de `name` no token continua sendo do backend.
5. **[feito] Não sair do áudio ao clicar em canal de texto.** A causa era o App Router remontar a página a cada troca de segmento dinâmico; o shell passou para `app/channels/layout.tsx`. Ver "Desvios em relação ao plano".
6. **[feito] Fullscreen e redimensionamento do vídeo transmitido.** Grade, foco com tira de miniaturas e tela cheia (`F`/`G`/`1`–`9`). Ver "Transmissões".

### UX e identidade visual

7. **[feito] Mascotes enquanto falamos.** Personagens pixelados âmbar: a boca segue o `audioLevel` real e, na faixa do rodapé, quem fala para de andar. Ver "Bonecos".
8. **Botão para trocar a cor/tema.** Adicionar controle na UI para alternar paleta sem editar manualmente os tokens em `app/globals.css`.

### Colaboração e extensões

9. **Compartilhamento de música.** Explorar audição conjunta/sincronizada, seja por sincronização de playback, seja por transmissão controlada de áudio, com atenção à latência e às implicações de produto/licenciamento.
10. **Bots de voz ativáveis por comando.** Permitir bots com presença em canal de voz e ativação por comandos/trigger de voz para ações úteis dentro da sala.
11. **[feito, aguardando backend] Sistema de arquivos.** Navegador de pastas e arquivos por canal, upload com progresso/cancelar/retry, preview de imagem e anexos no chat efêmero. Ver "Arquivos do canal". O cliente está completo e exercitável no modo mock; nenhum dos endpoints existe ainda na `shussei-api`.
12. **Excalidraw embutido.** Integrar um quadro colaborativo embutido para desenho/diagramação em tempo real.

### Canais e administração

13. **CRUD de canais no frontend.** Rotas backend concluídas e publicadas. Adicionar interface para criar, editar, reordenar e remover canais.
14. **Edição de allowlist pelo frontend.** Rotas backend concluídas e publicadas. Criar interface para adicionar, remover e revisar usuários autorizados.

### Conta e sessão

15. **[feito] Logout no frontend.** `[sair]` na status bar, derrubando o socket singleton na saída.
16. **Mudar username no frontend.** Endpoint backend concluído e publicado. Adicionar formulário e atualizar nome exibido sem novo login Google sobrescrever mudança.

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
4. **Boneco escolhido.** A sua escolha vive em `localStorage`: o `SessionUser`
   não tem campo para carregá-la, então os outros continuam vendo o personagem
   derivado do seu id. Precisa de um campo no DTO para ser compartilhada.
5. **Identidade no LiveKit.** Para casar participantes da sala com a presença
   do app, o token deve usar `identity = user.id` e `name = user.name`.
6. **Ocupação dos canais de voz.** Quem está em cada canal vem **só** do socket:
   `channelOccupancy` no `presence.snapshot` e o `channelId` no
   `presence.changed` que o servidor devolve depois de um `voice.join` /
   `voice.leave`. O cliente não tem outra fonte para canais em que você não
   está — se a sidebar aparece vazia em produção mas cheia no mock, o servidor
   não está mandando esses campos. Para o canal em que você **está**, o cliente
   agora usa a sala do LiveKit e não depende disso (ver `sidebarOccupancy` em
   `components/app-shell.tsx`).
7. **Cookie de sessão cross-origin.** Web em `:3000` e API em `:3001` são
   origens distintas: o cookie precisa de `SameSite=None; Secure` em produção
   (ou os dois atrás do mesmo host no Caddy) e o CORS precisa de
   `credentials: true`. **Leitura de arquivo já não depende disso**: passa
   pelo proxy same-origin em `app/files/[fileId]`. As chamadas de
   `apiFetch` e o socket continuam dependendo.
8. **Módulo de storage.** Nenhum dos endpoints de pasta/arquivo listados
   acima existe na `shussei-api`, `chat.send` faz bind de `{channelId, body}`
   e descarta campos desconhecidos, e `EphemeralMessage` não tem campo de
   anexo. Ver `docs/plans/2026-08-28-shussei-file-storage-frontend.md`,
   seção "Backend Pre-conditions".

## Desvios em relação ao plano

- O microfone é publicado com `setMicrophoneEnabled(true)` em vez de
  `createLocalAudioTrack` + `publishTrack`, para que mutar/desmutar atue na
  mesma track gerenciada pelo LiveKit.
- Arquivos além dos listados no plano: `components/screen-stage.tsx` (renderiza
  as telas compartilhadas), `components/room-audio.tsx` (sem ele ninguém escuta
  o áudio remoto), `components/ui/*` (primitivos do tema), `lib/mock/*`,
  `hooks/use-directory.ts`, `app/channels/page.tsx`, `Dockerfile`.
- **O shell mora no layout, não na página.** `app/channels/layout.tsx` renderiza
  o `AppShell` lendo o canal via `useParams`, e `app/channels/[channelId]/page.tsx`
  devolve `null`. O App Router **remonta** uma página quando o segmento dinâmico
  muda, e com o shell lá dentro cada clique em canal derrubava a sala do LiveKit
  — exatamente o que o dock de voz existe para evitar. Layout persiste entre
  segmentos irmãos e só re-renderiza.
- **`avatarUrl` não é renderizado.** O campo continua no `SessionUser` porque é
  contrato da API, mas as pessoas são desenhadas como personagens pixelados. Ver
  "Bonecos".

## Tema

O visual é um terminal CLI/cyberpunk (âmbar sobre preto, monoespaçado). Todas as
cores, bordas e fontes são tokens em `app/globals.css` (`@theme`) — trocar a
pele do app é editar esse bloco, não os componentes.

### Efeitos

Calibrados para uso longo: nada pisca forte, nada fica no caminho da leitura.
Tudo respeita `prefers-reduced-motion` — o CSS neutraliza os keyframes e os
efeitos em JS consultam `lib/motion-prefs.ts` para **não rodar**, em vez de
revelar o texto tarde.

| Efeito | Onde | Detalhe |
| --- | --- | --- |
| Boot log | `components/boot-sequence.tsx` | É o estado de carregamento, não um splash por cima dele. Roda uma vez por documento (`lib/boot-state.ts`), nunca em remontagem |
| Power-on do CRT | Shell e login | Linha horizontal que abre na vertical, 620ms |
| Scanlines + flicker | `body::before` | Cintilação de 2% com período de 9s |
| Sweep | `components/ui/crt-overlay.tsx` | Banda clara descendo o tubo |
| Glitch de canal | `<main>` do shell | Rasgo horizontal de 200ms ao trocar de canal |
| Scramble | Cabeçalho do chat | O nome do canal "decodifica" ao mudar. Só anima na **mudança**: embaralhar no primeiro render parece defeito |
| Typewriter | Mensagens do chat | Só o que chega ao vivo (< 10s). O buffer recuperado renderiza inteiro — datilografar uma hora de histórico mentiria sobre quando aquilo foi dito |
| Anel de fala | Avatares | Sombra que cresce com o `audioLevel` real; é medidor, não indicador binário |
| Estática | `ScreenStage` | Dois gradientes radiais deslocados: sem canvas e sem repaint por frame |
| Caminhada | `components/sprite-strip.tsx` | Ida e volta completas em **um** ciclo em vez de `alternate`, para que o giro do personagem seja uma segunda animação de mesma duração e não saia de sincronia com a primeira |
| Pulo | `sprite-hop` | Altura vinda do `audioLevel`. Continua rodando enquanto a caminhada está pausada — parar de andar existe justamente para o pulo aparecer |

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
