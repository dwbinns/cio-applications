
if (!Array.prototype.contains) Array.prototype.contains=function(o) {return this.indexOf(o)!=-1;};
if (!Array.prototype.find) Array.prototype.find=function(cb) {return this.reduce(function(prev,current,index,array){return prev===undefined && cb(current,index,array) ? current : prev;},undefined);};
if (!Array.prototype.some) Array.prototype.some=function(cb) {return this.reduce(function(prev,current,index,array){return prev || cb(current,index,array);},false);};
if (!Array.prototype.remove) Array.prototype.remove=function(o) {var i=this.indexOf(o);if (i>=0) this.splice(i,1);};
if (!String.prototype.startsWith) String.prototype.startsWith=function(s) {return this.substring(0,s.length)==s;};
if (!String.prototype.endsWith) String.prototype.endsWith=function(s) {return this.substring(this.length-s.length)==s;};
if (!Date.prototype.format) {
    Date.prototype.format=function(format) {
        var c={
            Y:this.getFullYear(),
            m:('00'+(this.getMonth()+1)).slice(-2),
            d:('00'+this.getDate()).slice(-2),
            H:('00'+this.getHours()).slice(-2),
            M:('00'+this.getMinutes()).slice(-2),
            S:('00'+this.getSeconds()).slice(-2),
            a:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][this.getDay()],
            b:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][this.getMonth]
            
        }
        return format.replace(/%([a-zA-Z])/g,function(s,n){return c[n];});
    };
}
if (!Date.prototype.rfcFormat) {
    Date.prototype.rfcFormat=function() {
        return this.format('%a, %d %b %Y %H:%M:%S %z');
    };
}
if ((typeof Element)!='undefined') {
    if (!Element.prototype.matches && Element.prototype.msMatchesSelector) Element.prototype.matches=function(selector){return this.msMatchesSelector(selector);};
    if (!Element.prototype.matches && Element.prototype.webkitMatchesSelector) Element.prototype.matches=function(selector){return this.webkitMatchesSelector(selector);};
    if (!Element.prototype.closest) {
        Element.prototype.closest=function(selector) {
            var reference=this;
            while (reference && !(reference.matches && reference.matches(selector))) reference=reference.parentNode;
            return reference;    
        };
    }
}
if (!Array.from) Array.from=function(i) {return [].slice.call(i);};