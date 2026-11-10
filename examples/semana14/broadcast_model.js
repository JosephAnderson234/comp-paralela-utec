const n=1e6,p=64,a=1e-5,b=1e-9;
const f=k=>(p+k-2)*(a+n*b/k);
const star=Math.sqrt(n*(p-2)*b/a);
const candidates=[Math.floor(star),Math.ceil(star)];
console.log(`pipeline: k*=${star.toFixed(3)}, T(78)=${f(78).toExponential(8)}, T(79)=${f(79).toExponential(8)}, entero=${candidates.reduce((x,y)=>f(x)<f(y)?x:y)}`);
