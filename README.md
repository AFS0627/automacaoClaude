# Claude Automation

Automação desenvolvida em **Node.js, TypeScript e Playwright** para monitorar o botão **Continuar** no site [Claude.ai](https://claude.ai).

O programa verifica periodicamente se o botão está habilitado e, quando fica disponível, realiza o clique automaticamente.

## Tecnologias utilizadas

- Node.js
- TypeScript
- Playwright
- Chromium / Google Chrome

## Funcionalidades

- Monitoramento automático do botão Continuar.
- Verificação a cada 1 minuto.
- Clique automático quando o botão estiver habilitado.
- Opção de continuar monitorando após o clique.
- Tecla `Q` para encerrar o programa a qualquer momento.
- Integração com uma sessão existente do Google Chrome.

## Requisitos

- Node.js instalado.
- Google Chrome instalado.
- Dependências do projeto instaladas.

## Como executar

Os arquivos PowerShell estão localizados na raiz do projeto.

### 1. Abrir o Chrome

Execute o arquivo:

```powershell
.\abrir-chrome.ps1
```

Esse script inicia o Google Chrome com a porta de depuração remota habilitada, permitindo que o Playwright se conecte ao navegador.

Na primeira execução, faça login no Claude normalmente.

**Importante:** mantenha essa janela do Chrome aberta enquanto o programa estiver funcionando.

### 2. Abrir o programa

Execute o arquivo:

```powershell
.\abrir-programa.ps1
```

Esse script inicia a automação.

Caso seja a primeira execução ou as dependências ainda não estejam instaladas, execute:

```bash
npm install
```

Também é possível iniciar diretamente pelo terminal:

```bash
npm start
```

## Controles

| Tecla | Ação |
|---|---|
| `S` | Continuar monitorando após um clique |
| `N` | Encerrar após um clique |
| `Q` | Encerrar imediatamente |

## Intervalo de verificação

O programa verifica a disponibilidade do botão a cada **60 segundos**.

Quando o botão Continuar fica habilitado, o programa realiza o clique e pergunta se deseja continuar monitorando.


## Instalação das dependências

Para instalar as dependências novamente após clonar o repositório:

```bash
npm install
npx playwright install chromium
```

## Licença

Projeto desenvolvido para fins de estudo e automação pessoal.
