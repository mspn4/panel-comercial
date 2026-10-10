/* Nombres fijos del panel — regla pedida por Sebastian (2026-10-10).
 * Algunos nombres vienen mal o largos en los datos de origen (ej. "ROIG BA¥A SEBASTIAN",
 * con la Ñ rota). Este script los corrige SOLO en pantalla: texto visible de la página,
 * atributos title/placeholder y etiquetas de gráficos Chart.js. Los datos (claves,
 * backups, filtros, exports a Excel) no se tocan, así que cruces y overrides siguen andando.
 * Para sumar otro nombre: agregar una entrada a REGLAS (más específicas primero).
 * Se incluye con <script src="assets/nombres-fijos.js"></script> en el <head>. */
(function(){
  var REGLAS = [
    // Apellido Nombre (tablas, listas)
    [/\bROIG\s+BA\S{1,2}A\s+SEBASTI[AÁ]N\b/gi, 'Roig Sebastian'],
    // Nombre Apellido (texto corrido)
    [/\bSEBASTI[AÁ]N\s+ROIG\s+BA\S{1,2}A\b/gi, 'Sebastian Roig'],
    // Apellido compuesto suelto
    [/\bROIG\s+BA\S{1,2}A\b/gi, 'Roig'],
  ];
  function fijar(s){
    if(typeof s !== 'string' || !/roig/i.test(s)) return s;
    for(var i=0;i<REGLAS.length;i++) s = s.replace(REGLAS[i][0], REGLAS[i][1]);
    return s;
  }
  window.nombreFijoPanel = fijar;

  function saltear(el){
    return !el || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(el.nodeName) || el.isContentEditable;
  }
  function procesar(nodo){
    if(nodo.nodeType === 3){
      if(saltear(nodo.parentNode)) return;
      var v = fijar(nodo.nodeValue);
      if(v !== nodo.nodeValue) nodo.nodeValue = v;
      return;
    }
    if(nodo.nodeType !== 1 || saltear(nodo)) return;
    ['title','placeholder','aria-label'].forEach(function(a){
      var v = nodo.getAttribute(a);
      if(v && /roig/i.test(v)){ var f = fijar(v); if(f !== v) nodo.setAttribute(a, f); }
    });
    for(var c = nodo.firstChild; c; c = c.nextSibling) procesar(c);
  }

  function iniciar(){
    procesar(document.body);
    new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var m = muts[i];
        if(m.type === 'characterData') procesar(m.target);
        else if(m.type === 'attributes') procesar(m.target);
        else for(var j=0;j<m.addedNodes.length;j++) procesar(m.addedNodes[j]);
      }
    }).observe(document.body, {childList:true, subtree:true, characterData:true,
      attributes:true, attributeFilter:['title','placeholder','aria-label']});

    // Chart.js dibuja en <canvas>: el observer no lo ve, se corrigen las etiquetas antes de dibujar.
    if(window.Chart && Chart.register){
      Chart.register({id:'nombresFijos', beforeUpdate:function(chart){
        var d = chart.data || {};
        if(Array.isArray(d.labels) && d.labels.some(function(l){ return /roig/i.test(String(l)); })){
          d.labels = d.labels.map(function(l){ return Array.isArray(l) ? l.map(fijar) : fijar(l); });
        }
        (d.datasets||[]).forEach(function(ds){ if(typeof ds.label === 'string') ds.label = fijar(ds.label); });
      }});
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
