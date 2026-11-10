const n=1000,t=1e-9,a=1e-6,b=1e-9,ln=Math.log(2);
const cases=[
 ['escalar lineal',Math.sqrt(2*n*t/(a+b+t)),p=>2*n*t/p+(p-1)*(a+b+t)],
 ['escalar hipercubo',2*n*t*ln/(a+b+t),p=>2*n*t/p+Math.log2(p)*(a+b+t)],
 ['filas lineal',Math.sqrt((2*n*n*t-n*b)/a),p=>2*n*n*t/p+(p-1)*(a+n*b/p)],
 ['filas hipercubo',(2*n*n*t-n*b)*ln/a,p=>2*n*n*t/p+a*Math.log2(p)+n*b*(p-1)/p],
 ['columnas lineal',Math.sqrt(2*n*n*t/(a+n*(b+t))),p=>2*n*n*t/p+(p-1)*(a+n*(b+t))],
 ['columnas hipercubo',2*n*n*t*ln/(a+n*(b+t)),p=>2*n*n*t/p+Math.log2(p)*(a+n*(b+t))]
];
for(const [name,star,f] of cases){const range=Array.from({length:n-1},(_,i)=>i+2);const best=range.reduce((x,y)=>f(x)<f(y)?x:y);const divisors=range.filter(p=>n%p===0);const div=divisors.reduce((x,y)=>f(x)<f(y)?x:y);console.log(`${name}: p*=${star.toFixed(3)}, entero=${best}, divisor de n=${div}, T=${f(div).toExponential(6)}`)}
const N=1e7,T=1e-9,A=1e-6,B=8e-9,C=A+B+T;
for(const [name,star,f] of [
 ['escalar lineal grande',Math.sqrt(2*N*T/C),p=>2*N*T/p+(p-1)*C],
 ['escalar hipercubo grande',2*N*T*ln/C,p=>2*N*T/p+Math.log2(p)*C]
]){const candidates=[Math.floor(star),Math.ceil(star)];const best=candidates.reduce((x,y)=>f(x)<f(y)?x:y);console.log(`${name}: p*=${star.toFixed(3)}, entero=${best}`)}
