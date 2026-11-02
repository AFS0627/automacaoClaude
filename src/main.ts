import { chromium, type Page } from 'playwright';
import { emitKeypressEvents } from 'node:readline';
import readline from 'node:readline/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const DEBUG_URL = process.env.DEBUG_URL ?? 'http://127.0.0.1:9222';
const INTERVALO_LIMITE = Number(process.env.INTERVALO ?? 60_000);
const TIMEOUT_PROMPT = Number(process.env.TIMEOUT_PROMPT ?? 600_000);
const ESTABILIDADE_MS = 15_000;
const ARQUIVO_FILA = process.argv[2] ?? process.env.FILA ?? 'fila.txt';
const ARQUIVO_PROGRESSO = `${ARQUIVO_FILA}.progresso.json`;
const esperar = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const hora = () => new Date().toLocaleTimeString('pt-BR');
const log = (...args: unknown[]) => console.log(`[${hora()}]`, ...args);
const formatarDuracao = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}min ${s % 60}s`;
};
function restaurarTerminal() {
    try {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
    } catch {}
}
function configurarTeclado() {
    emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', (_, key) => {
        if (key?.name?.toLowerCase() === 'q' || (key?.ctrl && key.name === 'c')) {
            log('Encerrado pelo usuário. O progresso foi salvo.');
            restaurarTerminal();
            process.exit(0);
        }
    });
}
process.on('exit', restaurarTerminal);
async function carregarFilaDeArquivo(): Promise<string[] | null> {
    let conteudo: string;
    try {
        conteudo = await readFile(ARQUIVO_FILA, 'utf8');
    } catch {
        return null;
    }
    if (ARQUIVO_FILA.toLowerCase().endsWith('.json')) {
        const dados = JSON.parse(conteudo);
        if (!Array.isArray(dados) || dados.some(p => typeof p !== 'string')) {
            throw new Error('O JSON da fila deve ser um array de strings.');
        }
        return dados.map(p => p.trim()).filter(Boolean);
    }
    return conteudo.split(/^\s*---\s*$/m).map(p => p.trim()).filter(Boolean);
}
async function carregarFilaInterativa(): Promise<string[]> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const quantidade = Number(await rl.question('Quantos prompts deseja deixar na fila? '));
        if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error('Quantidade inválida.');
        const prompts: string[] = [];
        for (let i = 0; i < quantidade; i++) {
            const p = (await rl.question(`Prompt ${i + 1}: `)).trim();
            if (p) prompts.push(p);
        }
        return prompts;
    } finally {
        rl.close();
    }
}
const hashFila = (prompts: string[]) => createHash('sha1').update(JSON.stringify(prompts)).digest('hex');
async function lerProgresso(hash: string): Promise<number> {
    try {
        const dados = JSON.parse(await readFile(ARQUIVO_PROGRESSO, 'utf8'));
        if (dados.hash === hash && Number.isInteger(dados.concluidos)) return dados.concluidos;
    } catch {}
    return 0;
}
async function salvarProgresso(hash: string, concluidos: number) {
    await writeFile(ARQUIVO_PROGRESSO, JSON.stringify({ hash, concluidos }, null, 2));
}
function criarAutomacao(page: Page) {
    const modal = page.getByRole('heading', { name: /upgrade para continuar|continuar conversando|upgrade to continue/i });
    const continuar = page.getByRole('button', { name: /^(Continuar|Continue)$/ });
    const agoraNao = page.getByRole('button', { name: /^(Agora não|Not now)$/i });
    const parar = page.locator('button[aria-label*="Stop"],button[aria-label*="Parar"],button[data-testid*="stop"]');
    const editor = page.locator('div[contenteditable="true"].ProseMirror, [contenteditable="true"][role="textbox"]').last();
    const limiteAtingido = () => modal.isVisible().catch(() => false);
    const gerando = () => parar.first().isVisible().catch(() => false);
    const tamanhoPagina = () => page.evaluate(() => document.body.innerText.length).catch(() => -1);
    async function aguardarLiberacao() {
        const inicio = Date.now();
        log('Limite atingido. Aguardando liberação...');
        while (true) {
            if (await agoraNao.isVisible().catch(() => false)) await agoraNao.click().catch(() => {});
            if ((await continuar.isVisible().catch(() => false)) && (await continuar.isEnabled().catch(() => false))) {
                await continuar.click();
                log(`Continuar clicado após ${formatarDuracao(Date.now() - inicio)} de espera.`);
                return;
            }
            await esperar(INTERVALO_LIMITE);
        }
    }
    async function aguardarResposta() {
        let inicio = Date.now();
        let iniciou = false;
        let ultimoTamanho = await tamanhoPagina();
        let ultimaMudanca = Date.now();
        while (true) {
            if (Date.now() - inicio > TIMEOUT_PROMPT) {
                throw new Error(`Timeout: a resposta não terminou em ${formatarDuracao(TIMEOUT_PROMPT)}.`);
            }
            if (await limiteAtingido()) {
                await aguardarLiberacao();
                iniciou = false;
                inicio = Date.now();
                ultimaMudanca = Date.now();
                continue;
            }
            if (await gerando()) {
                iniciou = true;
            } else if (iniciou) {
                await esperar(1500);
                if (!(await gerando()) && !(await limiteAtingido())) return;
                continue;
            } else {
                const tamanho = await tamanhoPagina();
                if (tamanho !== ultimoTamanho) {
                    ultimoTamanho = tamanho;
                    ultimaMudanca = Date.now();
                } else if (Date.now() - ultimaMudanca > ESTABILIDADE_MS && Date.now() - inicio > ESTABILIDADE_MS * 2) {
                    log('Botão de parar não detectado; resposta considerada concluída por estabilidade da página.');
                    return;
                }
            }
            await esperar(1000);
        }
    }
    async function enviarPrompt(prompt: string) {
        await editor.waitFor({ state: 'visible', timeout: 30_000 });
        await editor.fill('');
        await editor.fill(prompt);
        if (!(await editor.innerText()).trim()) throw new Error('O campo de texto ficou vazio após o preenchimento.');
        await editor.press('Enter');
        const limite = Date.now() + 10_000;
        while (Date.now() < limite) {
            const vazio = !(await editor.innerText().catch(() => 'x')).trim();
            if (vazio || (await gerando())) return;
            await esperar(500);
        }
        log('Envio não confirmado; tentando Enter novamente.');
        await editor.press('Enter');
    }
    return { limiteAtingido, aguardarLiberacao, aguardarResposta, enviarPrompt };
}
async function main() {
    let prompts = await carregarFilaDeArquivo();
    const usandoArquivo = prompts !== null;
    if (!prompts) prompts = await carregarFilaInterativa();
    if (prompts.length === 0) throw new Error('A fila está vazia.');
    const hash = hashFila(prompts);
    const inicioIndice = usandoArquivo ? await lerProgresso(hash) : 0;
    if (inicioIndice >= prompts.length) {
        log('Todos os prompts desta fila já foram concluídos. Apague o arquivo de progresso para refazer.');
        return;
    }
    if (inicioIndice > 0) log(`Retomando do prompt ${inicioIndice + 1}/${prompts.length}.`);
    if (usandoArquivo) log(`Fila carregada de ${ARQUIVO_FILA} (${prompts.length} prompts).`);
    configurarTeclado();
    const browser = await chromium.connectOverCDP(DEBUG_URL);
    const context = browser.contexts()[0];
    if (!context) throw new Error('Nenhum contexto encontrado no Chrome. Abra uma janela normal (não anônima).');
    const page = context.pages().find(p => p.url().startsWith('https://claude.ai'));
    if (!page) throw new Error('Abra o Claude (https://claude.ai) no Chrome.');
    const auto = criarAutomacao(page);
    log('Monitoramento iniciado. Pressione Q (ou Ctrl+C) para sair.');
    for (let i = inicioIndice; i < prompts.length; i++) {
        if (await auto.limiteAtingido()) await auto.aguardarLiberacao();
        log(`Prompt ${i + 1}/${prompts.length}`);
        const inicio = Date.now();
        await auto.enviarPrompt(prompts[i]);
        log('Prompt enviado:', prompts[i].length > 80 ? `${prompts[i].slice(0, 80)}…` : prompts[i]);
        await auto.aguardarResposta();
        log(`Resposta concluída em ${formatarDuracao(Date.now() - inicio)}.`);
        if (usandoArquivo) await salvarProgresso(hash, i + 1);
    }
    log('Fila concluída.');
    process.stdout.write('\x07');
}
main()
    .then(() => process.exit(0))
    .catch(erro => {
        console.error(`[${hora()}] Erro:`, erro instanceof Error ? erro.message : erro);
        process.exit(1);
    });
