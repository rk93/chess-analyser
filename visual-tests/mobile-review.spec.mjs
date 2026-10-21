import { test, expect } from '@playwright/test';

test('saved review keeps board and move controls usable on mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('#gamesTab').click();
  await page.evaluate(() => {
    for (const id of ['libraryView','boardLabView','analyticsView','topPlayersView']) document.getElementById(id)?.setAttribute('hidden','');
    const view=document.getElementById('analysisView');
    view.hidden=false; view.style.display='block'; view.classList.add('reviewProMode');document.body.classList.add('review-guided-active');
    const shell=view.querySelector('.analysisShell');
    let layout=document.getElementById('reviewDesktopLayout');
    if (!layout) {
      layout=document.createElement('div');
      layout.id='reviewDesktopLayout';layout.className='reviewDesktopLayout';
      shell.parentNode.insertBefore(layout,shell);layout.appendChild(shell);
    }
    let guide=document.getElementById('reviewGuideCard');
    if(!guide){guide=document.createElement('section');guide.id='reviewGuideCard';guide.className='reviewGuideCard';layout.insertBefore(guide,shell);}
    guide.hidden=false;
    guide.innerHTML=`<div class="reviewGuideTitle">✓ Ng5 · Good <span id="reviewGuideEval" class="reviewGuideEval" data-perspective="b" data-perspective-label="Black" title="White perspective">-0.62</span></div>
      <div class="reviewGuideComment">Ng5 moves the knight. The engine preferred O-O instead. This is a deliberately long explanation to test mobile overflow and reading while reviewing moves.</div>
      <div class="reviewGuideMeta">Engine verified · Position context · Best line O-O d6 Re1 Nf6</div>
      <div class="reviewGuideActions"><button id="reviewPrev" class="btn">Previous</button><button id="reviewAutoPlay" class="btn">Play</button><button id="reviewNext" class="btn">Next</button><button id="reviewShowBest" class="btn">Show best</button><button id="reviewVoiceToggle" class="btn">Voice</button><button id="reviewPractice" class="btn">Practice</button></div>`;
    const board=document.getElementById('board');
    board.style.cssText='display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);width:100%;height:100%';
    board.innerHTML=Array.from({length:64},(_,i)=>`<div style="background:${(Math.floor(i/8)+i%8)%2?'#78965b':'#eeeed2'}"></div>`).join('');
    const strip=document.createElement('div');strip.id='reviewProMoveStrip';strip.textContent='1. e4 e5 2. Nf3 Nc6 3. d4 exd4';view.querySelector('.sidePanel').prepend(strip);
    document.getElementById('topPlayer').textContent='Black 1414';
    document.getElementById('bottomPlayer').textContent='White 1434';
    const stats=document.createElement('div');stats.id='reviewPositionStats';stats.className='reviewPositionStats reviewMoveProgress';stats.innerHTML='<span class="reviewMoveProgressTrack" role="progressbar" aria-label="Moves reviewed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40"><span class="reviewMoveProgressFill" style="width:40%"></span></span><span class="reviewMoveProgressLabel">8 / 20</span>';document.getElementById('bottomPlayer').after(stats);
  });
  const board=page.locator('#analysisView .boardStage');
  const next=page.locator('#reviewNext');
  await expect(board).toBeVisible();
  await expect(next).toBeVisible();
  await expect(page.locator('#reviewGuideEval')).toHaveAttribute('data-perspective','b');
  const b=await board.boundingBox(), n=await next.boundingBox();
  expect(b.width).toBeGreaterThan(150);
  expect(b.height).toBeGreaterThan(150);
  expect(b.y).toBeLessThan(250);
  const coach=await page.locator('#reviewGuideCard').boundingBox();
  expect(coach.y + coach.height).toBeLessThanOrEqual(b.y + 2);
  // Catch controls obscuring the board, not just whether each is visible.
  expect(n.y).toBeGreaterThanOrEqual(b.y + b.height - 2);
  await expect(page.locator('.modernNav')).toBeHidden();
  await expect(page.locator('#reviewPositionStats')).toBeVisible();
  await expect(page.locator('#reviewPositionStats [role="progressbar"]')).toHaveAttribute('aria-valuenow','40');
  const buttons=await Promise.all(['reviewPrev','reviewAutoPlay','reviewNext','reviewShowBest'].map(id=>page.locator('#'+id).boundingBox()));
  for(let i=1;i<buttons.length;i++)expect(buttons[i].x).toBeGreaterThanOrEqual(buttons[i-1].x+buttons[i-1].width-2);
  for(const btn of buttons){expect(btn.y).toBeGreaterThanOrEqual(b.y+b.height-2);expect(btn.x+btn.width).toBeLessThanOrEqual(page.viewportSize().width+2)}
  expect(n.y+n.height).toBeLessThan(800);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('mobile-review.png'),fullPage:true});
});
