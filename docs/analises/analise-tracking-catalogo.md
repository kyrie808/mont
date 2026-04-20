# Relatório de Análise Técnica: Tracking de Conversões (Catálogo Mont)

## 1. LINKS E BOTÕES DE WHATSAPP

Foram pré-identificados múltiplos pontos de interação que direcionam o usuário para o WhatsApp. O número de destino é dinâmico, sendo obtido por meio da variável de ambiente `NEXT_PUBLIC_WHATSAPP_NUMBER`, possuindo como fallback um número fixo (`5511934417085`).

### **Ponto 1: CTA Principal do Carrinho (Pós-Pedido)**
- **Arquivo/Linha:** `app/(public)/carrinho/page.tsx` (linhas 125-135)
- **Componente:** `CarrinhoPage` (via botão "Enviar pelo WhatsApp" renderizado no `CheckoutForm` na linha 253)
- **Contexto:** Botão primário que submete o pedido concluído.
- **Mensagem:** O carrinho tem um gerador dinâmico de mensagem em `lib/whatsapp/checkout.ts`, incluindo os dados preenchidos no form, itens comprados, subtotais, taxa de entrega, método de pagamento e obs.
- **Acionamento:** Ocorre via `window.open(whatsappUrl, '_blank')` após a chamada à API de backend e o fluxo programático de sucesso.

### **Ponto 2: Link de Suporte/Dúvida no Checkout**
- **Arquivo/Linha:** `app/(public)/carrinho/_components/CheckoutForm.tsx` (linha 201)
- **Componente:** `CheckoutForm`
- **Contexto:** Link auxilar/ajuda caso o cliente não consiga preencher seu endereço ou CEP.
- **Mensagem Pré-preenchida:** *"Olá, estou com dificuldade para preencher meu endereço no catálogo Mont."*
- **Acionamento:** Fixo como tag `href`.

### **Ponto 3: Menu Principal de Navegação (CTA de Contato/Header)**
- **Arquivo/Linha:** `components/catalog/Navbar.tsx` (linha 86 e linha 201)
- **Componente:** `Navbar`
- **Contexto:** Link primário no header/navbar (ex: "Fale com a Gente").
- **Mensagem Pré-preenchida:** *"Olá! Gostaria de falar com a Mont."*
- **Acionamento:** Fixo como tag `href`.

### **Ponto 4: Chamada Final da Homepage (FinalCTA)**
- **Arquivo/Linha:** `app/(public)/_components/FinalCTA.tsx` (linha 86 e linha 145)
- **Componente:** `FinalCTA`
- **Contexto:** Último call-to-action (ex: "Pedir pelo WhatsApp") exibido na hero ou base das páginas de navegação.
- **Mensagem Pré-preenchida:** *"Olá! Gostaria de saber mais sobre os produtos da Mont Distribuidora."*
- **Acionamento:** Fixo como tag `href`.

### **Ponto 5: Rodapé do Site (Footer)**
- **Arquivo/Linha:** `components/catalog/Footer.tsx` (linha 5 e linha 25)
- **Componente:** `Footer`
- **Contexto:** Link útil listado no rodapé de todas as páginas públicas.
- **Mensagem Pré-preenchida:** *"Olá! Vim pelo site e gostaria de saber mais sobre os produtos."*
- **Acionamento:** Fixo como tag `href`.

---

## 2. FORMULÁRIO DE PEDIDO

**Sim, o site conta com um formulário que intercepta os dados do usuário antes de abrir a janela do WhatsApp.** 

- **Local:** `app/(public)/carrinho/_components/CheckoutForm.tsx`
- **Fluxo Completo de Submissão (`onSubmit` em `page.tsx`):**
  1. O usuário submete o formulário.
  2. Construção do Payload combinando dados do formulário (`react-hook-form` validados com Zod) com os itens do carrinho local persistidos.
  3. **Envio para API:** Um `POST` é efetuado enviando o payload inteiro para a API interna em `/api/pedidos` (que salva nativamente o pedido no Supabase).
  4. **Sucesso (Webhook/Redirecionamento):** Se o HTTP status for de sucesso, a aplicação forma a URL de disparo de WhatsApp por meio do `generateWhatsAppMessage()`.
  5. **Pop-up do WhatsApp:** A janela do WhatsApp abre dinamicamente utilizando o `window.open(whatsappUrl, '_blank')`.
  6. **Limpeza e Feedbacks:** Acontece a limpeza do carrinho `clearCart()` e encerramentos de estados de carregamento.
- **Observações:** O front **NÃO** dispara nenhum evento de conversão por padrão nestes trechos em tela - apenas submete para a base interna do app.  

---

## 3. ESTRUTURA DE CARRINHO / CATÁLOGO

- **Implementação do Carrinho:** Utiliza estado global viabilizado pela biblioteca **`Zustand`** em união com o middleware `persist`. Isso significa que os dados ficam contidos num store em memória e são gravados e validados no **`localStorage`** pela chave `mont-cart-storage` (em `src/lib/cart/store.ts`).
- **Páginas e Rotas de Catálogo:**
  - **Catálogo geral / Vitrine de lista:** Reside em `app/(public)/produtos/page.tsx`
  - **Produtos Individuais e Detalhados:** Possuem página própria na rota dinâmica SSR `app/(public)/produtos/[slug]/page.tsx`. Os dados dos produtos são extraídos do supabase rodando em Server Component via consulta em `vw_catalogo_produtos`.
- **Fluxo de Aquisição (Jornada):**
  1. O usuário vê a home ou uma `/produtos`.
  2. Ele entra na página do produto `/produtos/[slug]`.
  3. Ele interage com o `<AddToCartSection />` engatilhando um `addItem()` via Zustand que guarda no Local Storage.
  4. O usuário entra em `/carrinho` verificando seus itens e taxas de entrega (`SBC` calculada via CEP e etc).
  5. Entra o papel de Checkout, que leva pro formulário onde há captura explícita, envio de Pedido ao Backend, finalização e posterior disparo orgânico para o celular.

---

## 4. INSTRUMENTAÇÃO EXISTENTE

- **Inexistente:** Executamos buscas complexas ao longo de toda a raiz `src` da aplicação, em busca de objetos do tipo `dataLayer`, tags de inicialização como o `<Script />` via do Next.js, chamadas a `gtag()` ou scripts legados como `fbq()`. O retorno foi categoricamente zerado. Nem mesmo dentro do `app/layout.tsx` há nenhum pacote injetado sobre métricas - o layout tem apenas a lógica visual bruta do seu Preloader de logo gerada na montagem.
- **Status da Aplicação:** É um "Clean Slate" em termos de instrumentação de analíticos nesse momento.

---

## 5. RECOMENDAÇÃO DE PONTOS DE INSTRUMENTAÇÃO

Recomendamos, baseando-nos num framework padronizado com Push em `dataLayer` e disparo nativo via Google Tag Manager como gestor universal destas fontes e destinos:

### 1. Tag de Inicialização do GTM
A estrutura do Next App Router obriga a injetarmos os contêineres de base no topo dos Nodes DOM, recomendando utilizar o `<Script strategy="afterInteractive">` nativo em `app/layout.tsx` para assegurar injeção das tags e window scopes desde o load.

### 2. Eventos de E-commerce do Catálogo (Jornada GA4)
```javascript
// Exemplo do padrão
window.dataLayer.push({ event: '...', ecommerce: { ... } });
```
- **`view_item_list`:** Executar um `push` quando o catálogo de componentes é visualizado (lista geral de produtos em `produtos/page.tsx`).
- **`view_item` (Visualização de Produto):** Executar na inicialização do script da UI em lado Client (`useEffect`) das páginas de detalhes (`produtos/[slug]/page.tsx`).
- **`add_to_cart` (Adicionar ao Carrinho):** Atrelar um disparador dentro da função do Click do Componente `AddToCartSection.tsx` ou em camada de Proxy em actions diretas nos Stores do Zustand `addItem()`.
- **`begin_checkout` (Iniciou Pagamento/Formulário):** Disparar logo na montagem da pagina `/carrinho`. Passar os `items` obtidos e total calculado da store.
- **`purchase` (Conversão Válida / Compra Realizada):** Disparar **absolutamente** dentro do bloco `try {}` de `onSubmit` no `carrinho/page.tsx`, após receber no retorno o status code correspondente ao salvar no Supabase (`api/pedidos`). Este é o "Lead Validado", e já podemos despachar dados do Purchase Value com seu valor.

### 3. Evento "Leads e Desvios de Fuga"
- **`whatsapp_click`:** Instale `onClick` simples nas tags de `<a>` e `<Link>` identificadas da Footer, Navbars e FinalCTA enviando `{ event: "whatsapp_click", click_location: "footer" }`. Tratar como um Lead Genérico.
- O clique de Suporte sobre problemas no CEP em checkout também pode carregar o status `"checkout_support_click"`.
