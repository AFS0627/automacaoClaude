# Claude Automation

Automação desenvolvida em **Node.js, TypeScript e Playwright** para gerenciar uma fila de prompts no [Claude.ai](https://claude.ai).

O programa monitora o limite de mensagens, aguarda sua liberação e envia automaticamente os prompts configurados, um por vez, aguardando a conclusão de cada resposta.

## Tecnologias

- Node.js
- TypeScript
- Playwright
- Google Chrome
- PowerShell

## Funcionalidades

- Envio automático de uma fila de prompts.
- Configuração da quantidade e do conteúdo dos prompts pelo PowerShell.
- Leitura de filas por arquivos TXT ou JSON.
- Detecção da janela de limite atingido.
- Clique automático em **Agora não**.
- Monitoramento do botão **Continuar**.
- Envio automático após a liberação do limite.
- Espera pela conclusão de cada resposta antes de enviar o próximo prompt.
- Salvamento do progresso da fila em arquivo JSON.
- Retomada de filas interrompidas.
- Encerramento a qualquer momento com `Q` ou `Ctrl+C`.

## Requisitos

- Node.js instalado.
- Google Chrome instalado.
- npm instalado.

## Instalação

Clone o repositório e entre na pasta do projeto:

```bash
git clone URL_DO_REPOSITORIO
cd automacaoClaude
```

Instale as dependências:

```bash
npm install
npx playwright install chromium
```

## Como executar

Os arquivos PowerShell estão localizados na raiz do projeto.

### 1. Abrir o Chrome

Execute:

```powershell
.\abrir-chrome.ps1
```

O script inicia o Google Chrome com a depuração remota habilitada na porta `9222`.

Faça login no Claude normalmente, caso ainda não esteja autenticado.

**Mantenha essa janela do Chrome aberta durante toda a execução.**

### Abrir programa

Execute:

```powershell
.\abrir-programa.ps1
```


## Funcionamento do monitoramento

1. O programa verifica se o limite de mensagens foi atingido.
2. Se houver uma janela de upgrade, clica em **Agora não**.
3. Aguarda até o botão **Continuar** ficar habilitado.
4. Clica em **Continuar** quando disponível.
5. Envia o próximo prompt da fila.
6. Aguarda a conclusão da resposta.
7. Continua até terminar todos os prompts.

Se o limite acabar durante a execução, o programa aguarda a liberação e retoma o processamento.


## Controles

| Tecla | Ação |
|---|---|
| `Q` | Encerra a automação |
| `Ctrl+C` | Encerra a automação |

## Variáveis de ambiente

É possível personalizar algumas configurações:

| Variável | Padrão | Descrição |
|---|---|---|
| `DEBUG_URL` | `http://127.0.0.1:9222` | Endereço de depuração do Chrome |
| `INTERVALO` | `60000` | Intervalo de verificação do limite, em milissegundos |
| `TIMEOUT_PROMPT` | `600000` | Tempo máximo de espera por resposta, em milissegundos |
| `FILA` | `fila.txt` | Arquivo de fila utilizado por padrão |

Exemplo no PowerShell:

```powershell
$env:INTERVALO = "30000"
$env:TIMEOUT_PROMPT = "900000"
npm start
```


## Observações

A automação depende dos elementos da interface do Claude, como o botão **Continuar**, o botão **Agora não**, o editor de mensagens e o indicador de geração.

Alterações na interface do Claude podem exigir ajustes nos seletores utilizados pelo Playwright.

Este projeto foi desenvolvido para fins de estudo e automação pessoal.