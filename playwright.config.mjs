import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./visual-tests',timeout:30000,retries:process.env.CI?1:0,
 reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
 use:{baseURL:'http://127.0.0.1:8765',trace:'retain-on-failure',screenshot:'on'},
 webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',url:'http://127.0.0.1:8765',reuseExistingServer:!process.env.CI,timeout:30000},
 projects:[360,393,430].map(width=>({name:'android-'+width,use:{viewport:{width,height:800},deviceScaleFactor:1,isMobile:true,hasTouch:true}}))
});
