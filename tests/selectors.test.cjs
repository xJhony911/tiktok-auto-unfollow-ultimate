const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('tiktok-auto-unfollow.user.js','utf8');
const fn=source.slice(source.indexOf('    function buscarBotonesValidos()'), source.indexOf('    function cerrarModal()'));
function select(buttons, config={}, modal=true) {
  const ctx={config:{whitelist:'',...config},document:{querySelector:()=>modal?{querySelectorAll:()=>buttons}:null},extraerDatosFila:b=>({username:b.user,tieneCheckAzul:b.verified})};
  vm.createContext(ctx); return vm.runInContext(fn+';buscarBotonesValidos()',ctx);
                    }
const button=(text,user='alice',extra={})=>({textContent:text,user,dataset:{},...extra});
test('no modal means no targets',()=>assert.equal(select([button('Siguiendo')],{},false).length,0));
test('does not follow an already unfollowed account',()=>assert.equal(select([button('Seguir')]).length,0));
test('whitelist normalizes case and @',()=>assert.equal(select([button('Siguiendo')],{whitelist:' @ALICE '}).length,0));
test('friends and verified filters',()=>{assert.equal(select([button('Amigos')],{ignorarAmigos:true}).length,0);assert.equal(select([button('Following','alice',{verified:true})],{ignorarVerificados:true}).length,0);});
test('disabled and unidentified targets excluded',()=>assert.equal(select([button('Following','alice',{disabled:true}),button('Siguiendo','desconocido')]).length,0));
test('valid following row selected',()=>assert.equal(select([button('Following')])[0].dataset.ttUser,'alice'));
