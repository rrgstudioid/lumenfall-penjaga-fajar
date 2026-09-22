import { BladeMaster7BFixture } from '../../lib/game/blade-master-7b-fixture.ts';
const payload=new BladeMaster7BFixture().run();
document.querySelector<HTMLPreElement>('#result')!.textContent=JSON.stringify(payload,null,2);
(window as Window & {__bladeMaster7BFixture?:unknown}).__bladeMaster7BFixture=payload;
