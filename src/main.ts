import { chromium } from 'playwright';
import { emitKeypressEvents } from 'node:readline';
import readline from 'node:readline/promises';

const INTERVALO = 60000;
const DEBUG_URL = 'http://127.0.0.1:9222';

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const quantidade = Number(await rl.question('Quantos prompts deseja deixar na fila? '));
    if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error('Quantidade inválida.');

    const prompts: string[] = [];
    for (let i = 0; i < quantidade; i++) prompts.push(await rl.question(`Prompt ${i + 1}: `));
    rl.close();

    emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', (_, key) => {
        if (key?.name?.toLowerCase() === 'q') process.exit(0);
    });

    const browser = await chromium.connectOverCDP(DEBUG_URL);
    const context = browser.contexts()[0];
    const page = context.pages().find(p => p.url().startsWith('https://claude.ai'));
    if (!page) throw new Error('Abra o Claude no Chrome.');

    const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const modal = page.getByRole('heading', { name: 'Faça upgrade para continuar conversando' });
    const continuar = page.getByRole('button', { name: 'Continuar', exact: true });
    const agoraNao = page.getByRole('button', { name: 'Agora não', exact: true });
    const parar = page.locator('button[aria-label*="Stop"],button[aria-label*="Parar"],button[data-testid*="stop"]');

    async function verificarLimite(): Promise<boolean> {
        return await modal.isVisible().catch(() => false);
    }

    async function aguardarLiberacao() {
        console.log('Limite atingido. Aguardando liberação...');
        while (true) {
            if (await agoraNao.isVisible().catch(() => false)) await agoraNao.click();
            if (await continuar.isVisible().catch(() => false) && await continuar.isEnabled()) {
                await continuar.click();
                console.log('Continuar clicado!');
                return;
            }
            await esperar(INTERVALO);
        }
    }

    async function aguardarResposta() {
        let iniciou = false;
        while (true) {
            if (await verificarLimite()) {
                await aguardarLiberacao();
                iniciou = false;
            }
            const gerando = await parar.first().isVisible().catch(() => false);
            if (gerando) iniciou = true;
            if (iniciou && !gerando) return;
            await esperar(1000);
        }
    }

    async function enviarPrompt(prompt: string) {
        const editor = page.locator('[contenteditable="true"]').last();
        await editor.waitFor({ state: 'visible' });
        await editor.fill(prompt);
        await editor.press('Enter');
        console.log('Prompt enviado:', prompt);
        await aguardarResposta();
        console.log('Resposta concluída.');
    }

    console.log('\nMonitoramento iniciado. Q para sair.');

    for (let i = 0; i < prompts.length; i++) {
        if (await verificarLimite()) await aguardarLiberacao();
        console.log(`\nPrompt ${i + 1}/${prompts.length}`);
        await enviarPrompt(prompts[i]);
    }

    console.log('\nFila concluída.');
    process.stdin.setRawMode(false);
    process.stdin.pause();
}

main().catch(console.error);