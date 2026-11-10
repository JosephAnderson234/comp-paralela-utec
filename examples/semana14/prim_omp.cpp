#include <algorithm>
#include <iostream>
#include <vector>
#include <tuple>
#include <omp.h>
using namespace std;
int main(){const int n=5,INF=999;int a[n][n];for(auto &r:a)for(int &x:r)x=INF;for(auto [u,v,w]:vector<tuple<int,int,int>>{{0,1,2},{0,2,3},{1,2,1},{1,3,4},{2,3,5},{2,4,6},{3,4,2}})a[u][v]=a[v][u]=w;vector<int>d(n,INF),par(n,-1),used(n);d[0]=0;int total=0;for(int step=0;step<n;step++){int bestD[2]={INF,INF},bestV[2]={-1,-1};
#pragma omp parallel for num_threads(2)
for(int q=0;q<2;q++){int lo=q?3:0,hi=q?5:3;for(int i=lo;i<hi;i++)if(!used[i]&&(d[i]<bestD[q]||(d[i]==bestD[q]&&(bestV[q]<0||i<bestV[q])))){bestD[q]=d[i];bestV[q]=i;}}int q=(bestV[1]>=0&&(bestD[1]<bestD[0]||(bestD[1]==bestD[0]&&bestV[1]<bestV[0])))?1:0;int u=bestV[q];used[u]=1;if(par[u]>=0)total+=d[u];cout<<"paso "<<step<<": P0="<<bestV[0]<<"("<<bestD[0]<<") P1="<<bestV[1]<<"("<<bestD[1]<<") elige="<<u<<"\n";
#pragma omp parallel for num_threads(2)
for(int v=0;v<n;v++)if(!used[v]&&a[u][v]<d[v]){d[v]=a[u][v];par[v]=u;}}
cout<<"padres:";for(int x:par)cout<<' '<<x;cout<<"\npeso="<<total<<"\n";}
