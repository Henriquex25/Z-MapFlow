"""Refresh shared validation symbols from the pinned ZMK profile (MIT licensed)."""
import json,re,urllib.request,pathlib
REV='4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85'
BASE=f'https://raw.githubusercontent.com/zmkfirmware/zmk/{REV}/app/include/'
headers={};pending=['keys','bt','outputs','rgb','ext_power','pointing','backlight','modifiers','hid_usage','hid_usage_pages']
while pending:
 name='dt-bindings/zmk/'+pending.pop()+'.h'
 if name in headers:continue
 
 for attempt in range(3):
  try:
   source=urllib.request.urlopen(BASE+name,timeout=20).read().decode();break
  except Exception:
   if attempt==2:raise
 headers[name]=source
 pending += [p.rsplit('/',1)[1][:-2] for p in re.findall(r'#include <(dt-bindings/zmk/[^>]+)>',source) if p not in headers]
def defs(source):
 source=re.sub(r'/\*[\s\S]*?\*/','',source);source=source.replace('\\\n',' ')
 return list(re.finditer(r'^\s*#define\s+([A-Za-z_]\w*)(\(([^)]*)\))?[^\n]*',source,re.M))
functions={};symbols=[]
for source in headers.values():
 for m in defs(source):
  if m[2] is not None:functions[m[1]]=len([s for s in m[3].split(',') if s.strip()])
  else:symbols.append(m[1])
# Zephyr helper expressions used in public ZMK header APIs.
functions.update({'BIT':1,'BIT_MASK':1,'GENMASK':2})
bindings={'kp':['keycode'],'kt':['keycode'],'mt':['keycode','keycode'],'lt':['layer','keycode'],'mo':['layer'],'to':['layer'],'tog':['layer'],'sl':['layer'],'sk':['keycode'],'bt':['btCommand'],'out':['output'],'mkp':['mouseButton'],'mmv':['move'],'msc':['scroll'],'rgb_ug':['rgbCommand'],'bl':['backlightCommand'],'ext_power':['power'],'inc_dec_kp':['keycode','keycode']}
for name in ['none','trans','bootloader','caps_word','key_repeat','sys_reset','studio_unlock','soft_off','gresc']:bindings[name]=[]
choices={
 'output':['OUT_USB','OUT_BLE','OUT_TOG'],
 'mouseButton':['LCLK','RCLK','MCLK']+[f'MB{i}' for i in range(1,6)],
 'move':['MOVE_UP','MOVE_DOWN','MOVE_LEFT','MOVE_RIGHT'],
 'scroll':['SCRL_UP','SCRL_DOWN','SCRL_LEFT','SCRL_RIGHT'],
 'backlight':['BL_TOG','BL_ON','BL_OFF','BL_INC','BL_DEC','BL_CYCLE','BL_SET'],
 'power':['EP_ON','EP_OFF','EP_TOG'],
}
commands={'bt':{'BT_CLR':[],'BT_NXT':[],'BT_PRV':[],'BT_CLR_ALL':[],'BT_SEL':['profile'],'BT_DISC':['profile']},'rgb_ug':{}}
for name in ['RGB_TOG','RGB_ON','RGB_OFF','RGB_HUI','RGB_HUD','RGB_SAI','RGB_SAD','RGB_BRI','RGB_BRD','RGB_SPI','RGB_SPD','RGB_EFF','RGB_EFR']:commands['rgb_ug'][name]=[]
commands['bl']={name:[] for name in ['BL_ON','BL_OFF','BL_TOG','BL_INC','BL_DEC','BL_CYCLE']}
commands['bl']['BL_SET']=['percent']
for name,args in list(commands['bl'].items()):commands['bl'][name+'_CMD']=args or ['integer']
commands['rgb_ug'].update({'RGB_EFS':['integer'],'RGB_COLOR_HSB_CMD':['integer']})
# Explicit command constants require their second cell instead of shorthand expansion.
for name,args in list(commands['bt'].items()):commands['bt'][name+'_CMD']=args or ['integer']
for name,args in list(commands['rgb_ug'].items()):
 if not name.endswith('_CMD'):commands['rgb_ug'][name+'_CMD']=args or ['integer']
locale_source=pathlib.Path(__file__).parent.parent.joinpath('firmware/keys_pt_abnt2.h').read_text()
locale_keys={m[1] for m in defs(locale_source) if m[2] is None and m[1].startswith('PT_')}
known=set(symbols)|set(functions)
for key in commands:commands[key]={name:args for name,args in commands[key].items() if name in known}
# Object-like aliases may name function-like macros (e.g. RGB_COLOR_HSV).
for source in headers.values():
 for m in defs(source):
  if m[2] is None:
   body=re.sub(r'^\s*#define\s+'+m[1]+r'\s*','',m[0]).strip(' ()\t')
   if body in functions:functions[m[1]]=functions[body]
native_arities={'zmk,behavior-'+name:count for name,count in {'key-press':1,'hold-tap':2,'tap-dance':0,'mod-morph':0,'sticky-key':1,'caps-word':0,'key-repeat':0,'key-toggle':1,'momentary-layer':1,'toggle-layer':1,'to-layer':1,'input-two-axis':1,'macro':0,'macro-one-param':1,'macro-two-param':2}.items()}
data={'nativeArities':native_arities,'revision':REV,'bindings':bindings,'symbols':sorted(set(symbols)),'keycodes':sorted({m[1] for m in defs(headers['dt-bindings/zmk/keys.h']) if m[2] is None}|locale_keys),'functions':functions,'choices':choices,'commands':commands}
pathlib.Path(__file__).with_name('catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(len(data['keycodes']),'keycodes,',len(data['symbols']),'symbols')
