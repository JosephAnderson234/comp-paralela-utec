#include <iostream>
#include <vector>
#include <omp.h>
using namespace std;
void run(vector<vector<int>> d){int n=d.size(),inf=999;for(int k=0;k<n;k++){auto prev=d;
#pragma omp parallel for num_threads(2)
for(int i=0;i<n;i++)for(int j=0;j<n;j++)if(prev[i][k]<inf&&prev[k][j]<inf)d[i][j]=min(prev[i][j],prev[i][k]+prev[k][j]);}
cout<<"n="<<n<<"\n";for(auto &r:d){for(int x:r){if(x==inf)cout<<"inf ";else cout<<x<<' ';}cout<<'\n';}}
int main(){run({{0,4,5},{2,0,999},{999,-3,0}});run({{0,2,5,999,999,999},{999,0,7,1,999,8},{999,999,0,4,999,999},{999,999,999,0,3,999},{999,999,2,999,0,3},{999,5,999,2,4,0}});}
