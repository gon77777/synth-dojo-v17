/* MR-5a〜5g MRコース 初級(mr01〜mr06)・中級(mr07〜mr15)・上級(mr16〜mr24)・発展(mr25〜mr27)。マスタリング。仕上げの道具(OUT TRIM・LIM GAIN・CEILING)と計測(LUFS・TP・LIM GR)で、音量を揃えて確かめる。
   土台のミックスは ms.js の整ったミックス(SD.MS_TRK(SD.MS_FIN))。仕様: docs/SPEC_MR5_mastering_lessons.md。
   数値(目標の範囲・聞き比べの音量補正 g)は案で未測定(O-1・O-4)。年号・人名・機材名・外部の規格名は書かない */
(function(){
 var T=SD.TERMS,A=function(id,name,kana,en,def,see,tags){T.push({id:id,name:name,kana:kana,en:en,def:def,see:see,tags:tags||['MR']})};
 A('mr_master','マスタリング','ますたりんぐ','mastering','完成したミックスの最後の仕上げ。音のバランス・大きさとピーク・いろいろな環境での聞こえ方を整える。直すのは最後の少しだけ。',['mr01'],['MR']);
 A('mr_ceil','天井','てんじょう','ceiling','リミッターが守る上限の音量(CEILING)。これより大きな音は出ない。変換や再生の余裕のため、-1 dB 付近にすることが多い。',['mr05'],['MR']);
 A('mr_gain','押し込み','おしこみ','input gain','リミッターに入れる音の量(LIM GAIN)。上げるほど平均の大きさが上がり、リミッターが多く削る。',['mr06'],['MR']);
 A('mr_mc','出口のコンプ','でぐちのこんぷ','output compressor','マスターの出口(リミッターの手前)に元から入っている、軽いコンプ(OUT COMP)。FXタブのCOMPとは別のもの。',['mr07'],['MR']);
 A('mr_ms','M/S','えむえす','mid/side','音を、中央(ミッド)と、左右の差(サイド)に分けて扱う方法。MASTER EQのMODEで、EQをかける相手を選べる。',['mr16'],['MR']);
 A('mr_clipper','クリッパー','くりっぱー','clipper','リミッターの手前で、大きな山を先に落とす道具(CLIPPER)。SOFTは丸く、HARDは平らに落とす。山が減る分、リミッターの働きが減る。',['mr17'],['MR']);
 A('mr_look','ルックアヘッド','るっくあへっど','lookahead','リミッターが音を先に読む長さ(LOOKAHEAD)。短いと歪みやすく、長いと音の出だしがなまりやすい。',['mr18'],['MR']);
 A('mr_psr','PSR','ぴーえすあーる','peak to short-term loudness ratio','ピークと、短い時間の大きさ(LUFS-S)との差。押し込むほど小さくなり、ダイナミクスの残り量の目安になる。',['mr19'],['MR']);
 A('mr_dr','ダイナミックレンジ','だいなみっくれんじ','dynamic range','小さい音から大きい音までの幅。つぶすほど狭くなる。PSRやCRESTで、数字として見られる。',['mr19'],['MR']);
 A('mr_norm','ノーマライズ','のーまらいず','loudness normalization','再生する側が、曲の大きさを目標に合わせて自動で揃えること。大きすぎる曲は下げられる。一度つぶした音は、下げても元に戻らない。',['mr20'],['MR']);
 A('mr_dither','ディザ','でぃざ','dither','16bitなどに減らすとき、ごく小さなノイズを混ぜて、量子化のざらつきを目立たなくする処理。小さな音の余韻で効果が分かる。',['mr25'],['MR']);
 A('mr_lossy','ロッシー','ろっしー','lossy compression','聞こえにくい情報を捨てて、データを小さくする圧縮。再生すると、高域が減ったり、音がにじんだりしやすい。',['mr26'],['MR']);
 SD.CATS.push({id:'mr4',synth:'analog',chapter:'course',course:'MR',name:'MR マスタリング 発展'});
 SD.CATS.push({id:'mr3',synth:'analog',chapter:'course',course:'MR',name:'MR マスタリング 上級'});
 SD.CATS.push({id:'mr2',synth:'analog',chapter:'course',course:'MR',name:'MR マスタリング 中級'});
 SD.CATS.push({id:'mr1',synth:'analog',chapter:'course',course:'MR',name:'MR マスタリング 初級'});
 /* 総合課題の専用ミックス(行: [tVol,tPan,tRvb,iEqHpf,iEqHg])。音が小さい・低域が濁る(HPF 20Hz)・幅が広い(PAN ±.8)。天井が高すぎは init(limCeil -0.1)で作る。数値は案で未測定 */
 SD.MR_RAW=[[.6,0,0,20,0],[.3,.8,.1,400,3],[.5,0,0,20,0],[.3,.8,.4,20,0],[.35,-.8,.4,200,0]];
 var TRK=SD.MS_TRK,FIN=SD.MS_FIN,tm=SD.MS_TM,BAD=SD.MS_BAD,MM=function(trk,k,lo,hi){return {trk:trk,ins:'mix',k:k,rng:[lo,hi]}},qz=function(q,ans,ex){return {q:q,ans:ans,ex:ex}};
 /* 前の回の設定を持ち越さない: マスターの出口は既定値に戻す(古い曲と同じ音) */
 var INIT=function(o){return Object.assign({rvbMix:.2,rvbType:3,rvbSize:1.8,rvbPre:30,rvbDamp:.5,dlyMix:0,swOn:0,cpOn:0,outTrim:0,limGain:0,limCeil:-1,limRel:80,limLook:2,limTP:0,mcOn:1,clipOn:0,mqOn:0,monoBelow:0},o||{})};
 var base=function(o){return Object.assign({cat:'mr1',synth:'analog',lv:2,course:'MR',mode:'trk',tab:'trk',oct:-1,demo:{n:[33]},kind:'recipe',ts:1,tk:TRK(FIN),init:INIT()},o)};
 var COL=function(b){return {h:'まとめ',b:b+'小さめの音量で、こまめに休もう。'}};
 SD.LESSONS.push(
base({id:'mr01',kind:'read',pre:['ms03'],terms:['mr_master'],title:'マスタリングとは',sub:'完成したミックスの最後の仕上げ',save:{name:'マスタリングの地図',kind:'kit'},steps:[
 {h:'最後の仕上げ',b:'【マスタリング】は、完成したミックスの最後の仕上げ。目的は3つ。音のバランスを整える、大きさとピークを目的に合わせる、いろいろな環境で崩れないか確かめる。',tab:'mix'},
 {h:'直すのは最後の少しだけ',b:'低音の濁りや、トラックの音量バランスは、MXやXBコースに戻って直す。マスターで大きく直そうとすると、別の部分が崩れやすい。',tab:'mix'},
 {h:'道具の地図',b:'FXタブの出口には、OUT TRIM・出口のコンプ・MASTER EQ・CLIPPER・LIMITERがある。MIXタブの計測行では、LUFS・TP・LIM GRを見られる。',tab:'fx'},
 {h:'共通の作法',b:'比べるときは、音量を揃える。大きい方が良く聞こえるので、揃えないと判断を間違える。処理なしと、軽い仕上げ(音量は揃えてある)を聴こう。',tab:'mix',cmp:[{l:'処理なし',s:{limGain:0,mcOn:0}},{l:'軽い仕上げ',s:{limGain:4,mcOn:1},g:-3}],
  col:COL('マスタリングは、ミックスの代わりではなく、ミックスの最後の確認と微調整。')}
 ]}),
base({id:'mr02',pre:['mr01','lm11'],terms:['lm_match'],title:'音量を揃えて聞き比べる',sub:'大きい方が良く聞こえる。MASTER BYPASS',save:{name:'音量を揃えた聞き比べ',kind:'kit'},steps:[
 {h:'大きい方が良く聞こえる',b:'同じ曲でも、大きい音のほうが「良い音」に聞こえやすい。AとBを聴いて、大きく聞こえる方を選ぼう。',tab:'fx',
  cmp:[{l:'A',s:{limGain:0}},{l:'B',s:{limGain:6}}],quiz:qz('大きく聞こえるのは?',2,'2が正解。Bはリミッターに多く入れて、音量が上がっている。')},
 {h:'揃えて聴く',b:'次は【音量をそろえる】。Bの音量を下げて揃えると、差は音量ではなく、音の質感だけになる。さっきと印象が変わるか確かめよう。',tab:'fx',
  cmp:[{l:'A',s:{limGain:0}},{l:'B(音量を揃えた)',s:{limGain:6},g:-4}]},
 {h:'MASTER BYPASS',b:'MIXタブの「MASTER BYPASS」は、EQ・出口コンプ・クリッパー・リミッターの押し込みをまとめて外し、音量を揃えて聴ける。ONとOFFを切り替えて比べよう。',tab:'mix',
  col:COL('BYPASSは、MIXタブを離れるとOFFに戻る。外したまま作業しないための安全策。')}
 ]}),
base({id:'mr03',pre:['mr02','xb05'],terms:['limiter','headroom','gr'],title:'余白をつくる(OUT TRIM)',sub:'入口の大きさでリミッターの働きを整える',save:{name:'余白のある入口',kind:'kit'},init:INIT({outTrim:6}),steps:[
 {h:'入れすぎると働きすぎる',b:'出口の【リミッター】に入る音が大きすぎると、削る量が増えて音がつぶれる。入口の大きさを整えて、【ヘッドルーム】(余白)を作る。',tab:'fx'},
 {h:'GRを見る',b:'OUT TRIMは+6dBになっている。MIXタブのLIM GRを見よう。0dBと+6dBを聴くと、+6は大きいが、リミッターが多く削っている(音量は揃えていない)。',tab:'mix',cmp:[{l:'OUT TRIM 0 dB',s:{outTrim:0}},{l:'OUT TRIM +6 dB',s:{outTrim:6}}]},
 {h:'GRを0〜1dBに',b:'OUT TRIMを下げて、LIM GRが0〜1dBに収まるよう調整しよう。3秒保てたら合格。',tab:'fx',mt:[{trk:'M',m:'grLim',rng:[0,1],hold:3}],
  col:COL('OUT TRIMは入口の音量。次の回で扱う天井(CEILING)は、出口の上限で、別のもの。')}
 ]}),
base({id:'mr04',pre:['mr03','lm04'],terms:['lm_target','lm_lufss'],title:'目標の大きさにする',sub:'LUFS-Sを見ながらLIM GAINで合わせる',save:{name:'配信向けの大きさ',kind:'kit'},steps:[
 {h:'目標は目安',b:'配信向けの【目標ラウドネス】の目安は -14 LUFS(放送向けは -23)。LUFS画面の「目標」で選べる。数字は目安で、変わることもある。小さめと大きめを聴こう。',tab:'mix',cmp:[{l:'小さめ',s:{limGain:0}},{l:'大きめ',s:{limGain:8}}]},
 {h:'0から始める',b:'LIM GAINを0dBにして、MIXタブの【LUFS-S】を見よう。目標より小さければ、LIM GAINで押し込んで上げる。',tab:'fx',f:[['limGain',0]]},
 {h:'目標に入れる',b:'LIM GAINを動かして、LUFS-Sを -15〜-13 に入れ、3秒保とう(配信向けの目安 -14)。',tab:'mix',mt:[{trk:'M',m:'lufsS',rng:[-15,-13],hold:3}],
  col:COL('大きく作る必要はない。つぶした音は、再生側で音量を下げても、元には戻らない。')}
 ]}),
base({id:'mr05',pre:['mr04'],terms:['mr_ceil','lm_tp','peak'],title:'天井(CEILING)を決める',sub:'上限は余裕のある -1 dB 付近',save:{name:'天井 -1 dB',kind:'kit'},init:INIT({limGain:6}),steps:[
 {h:'天井とは',b:'【天井】は、リミッターが守る上限の音量。天井が低いほど、上に余裕がある。-0.1dBと -3dBを、音量を揃えて聴こう。',tab:'fx',
  cmp:[{l:'天井 -0.1 dB',s:{limCeil:-.1,limGain:6},g:-2.9},{l:'天井 -3 dB',s:{limCeil:-3,limGain:6}}],quiz:qz('天井が低い(余裕がある)のは?',2,'2が正解。音量を揃えると、音色の差はわずか。差は、上の余裕にある。')},
 {h:'サンプルの間の山',b:'【トゥルーピーク】(TP)は、サンプルの間の山まで見た値。変換や再生で割れないよう、天井は -1 dB 付近にする。MIXタブのTPで見よう(近似)。',tab:'mix'},
 {h:'-1 dB に決める',b:'CEILINGを -1.0 dB にしよう。大きな音は、これより上に出なくなる。',tab:'fx',f:[['limCeil',-1]]},
 {h:'TPを確かめる',b:'LIM GAINが +6 dBのまま、TPが -1.6〜-0.6 に入るのを、3秒保って確かめよう。',tab:'mix',mt:[{trk:'M',m:'tp',rng:[-1.6,-.6],hold:3}],
  col:COL('TPメーターは近似で、山をやや低く見積もる。天井ぎりぎりを狙わず、少し余裕を持たせる。')}
 ]}),
base({id:'mr06',pre:['mr05','ms03'],terms:['mr_gain','limiter','gr'],title:'押し込み(GAIN)と音圧の入口',sub:'入れすぎるとつぶれる。GRは控えめに',save:{name:'控えめな押し込み',kind:'kit'},steps:[
 {h:'入れる量で大きさが決まる',b:'リミッターにどれだけ入れるかで、平均の大きさが決まる。これが【押し込み】。GAIN 0と+8を聴こう(音量は揃えない)。',tab:'fx',
  cmp:[{l:'GAIN 0',s:{limGain:0}},{l:'GAIN +8',s:{limGain:8}}],quiz:qz('大きく聞こえるのは?',2,'2が正解。ただし、大きいから良い、とは限らない。')},
 {h:'揃えて比べる',b:'次は音量を揃えて聴こう。+8の方は、山が削られて、少し窮屈に聞こえないか。',tab:'fx',
  cmp:[{l:'GAIN 0',s:{limGain:0}},{l:'GAIN +8(音量を揃えた)',s:{limGain:8},g:-5}],quiz:qz('山が削られて窮屈なのは?',2,'2が正解。入れすぎは、大きさと引き換えに、抑揚を失う。')},
 {h:'+4 dB から',b:'LIM GAINを+4dBにして、MIXタブのLIM GRを見よう。大きな音のときだけ、少し削られる。',tab:'fx',f:[['limGain',4]]},
 {h:'GRを1〜3dBに',b:'LIM GAINを動かして、LIM GRが1〜3dBに収まるよう調整しよう。3秒保てたら合格。削りすぎない、が目安。',tab:'mix',mt:[{trk:'M',m:'grLim',rng:[1,3],hold:3}],
  col:COL('GRの目安は曲による。大きさより、聴いて自然かどうかを優先しよう。')}
 ]})
 );
 SD.LESSONS.push(
base({id:'mr07',cat:'mr2',pre:['mr06','ms01'],terms:['mr_mc','gr'],title:'出口のコンプ(見えなかった固定コンプ)',sub:'元から入っている軽い圧縮を、見て・動かす',save:{name:'出口のコンプの設定',kind:'kit'},steps:[
 {h:'元から入っている',b:'出口には、いつもONの【出口のコンプ】がある(OUT COMP)。FXタブのCOMPとは別もの。OFFとONを聴こう(音量は揃えてある)。',tab:'fx',
  cmp:[{l:'OFF',s:{mcOn:0},g:-1.5},{l:'ON',s:{mcOn:1}}],quiz:qz('まとまって聞こえるのは?',2,'2が正解。軽く掛かって、山が揃い、まとまりが出る。差は小さくてよい。')},
 {h:'深く掛けてみる',b:'THRESHを-24dBに、RATIOを8にしよう。MIXタブのGRが増える。深く掛けるほど、山がつぶれていく。',tab:'fx',f:[['mcOn',1],['mcThr',-24],['mcRatio',8]]},
 {h:'軽く戻す',b:'THRESHを-10dBに、RATIOを2に戻そう。さっきの深い設定と、軽い設定を聴き比べよう(音量は揃えてある)。',tab:'fx',f:[['mcThr',-10],['mcRatio',2]],
  cmp:[{l:'軽い',s:{mcThr:-10,mcRatio:2}},{l:'深い',s:{mcThr:-24,mcRatio:8,mcMake:4}}],quiz:qz('窮屈に聞こえるのは?',2,'2が正解。深いほど、山がつぶれて、抑揚が減る。'),
  col:COL('マスターは、軽くまとめるのが基本。深く掛けたくなったら、ミックス側(トラックのコンプ)に戻ろう。')}
 ]}),
base({id:'mr08',cat:'mr2',pre:['mr06'],terms:['limiter'],title:'リリースとポンピング',sub:'リミッターが元に戻る速さ',save:{name:'リミッターのリリース',kind:'kit'},init:INIT({limGain:8}),steps:[
 {h:'短いリリース',b:'LIM GAINが+8dBで、リミッターがよく働いている。RELEASEが10msと80msを聴こう。短いと、素早く戻りすぎて、低音が揺れ、歪みやすい。',tab:'fx',
  cmp:[{l:'10 ms',s:{limRel:10}},{l:'80 ms',s:{limRel:80}}],quiz:qz('揺れや歪みが出やすいのは?',1,'1が正解。短いリリースは、音の波に追いつきすぎて、ざらつく。')},
 {h:'長いリリース',b:'RELEASEを400msにしよう。戻りがゆっくりになり、一度下がった音が引っ込んだままになりやすい。80msと聴き比べよう。',tab:'fx',f:[['limRel',400]],
  cmp:[{l:'80 ms',s:{limRel:80}},{l:'400 ms',s:{limRel:400}}]},
 {h:'ほどよい値へ',b:'RELEASEを100msにしよう。目安であり、曲のテンポや低音の量で、ちょうど良い値は変わる。',tab:'fx',f:[['limRel',100]],
  col:COL('迷ったら、短すぎず長すぎない値から。聴いて、揺れや引っ込みが気にならなければ十分。')}
 ]}),
base({id:'mr09',cat:'mr2',pre:['mr06','ms02'],terms:['eq'],title:'マスターEQは「広く・小さく」',sub:'シェルフを±2dB以内で使う',save:{name:'小さく広いマスターEQ',kind:'kit'},steps:[
 {h:'広く・小さく',b:'仕上げのEQは、広い範囲を、少しだけ動かす。MASTER EQのLOW(低域シェルフ)とHIGH(高域シェルフ)を、±2dB以内で使う。ON/OFFでも音量は変わらない。',tab:'fx'},
 {h:'低域を少し',b:'MASTER EQをONにして、LOWを+1.5dBにしよう。低域が少し厚くなる。大きく上げると、濁りやすい。',tab:'fx',f:[['mqOn',1],['mqLoG',1.5]]},
 {h:'高域を少し',b:'HIGHを+1.5dBにしよう。高域が少し明るくなる。上げすぎると、刺さりやすい。',tab:'fx',f:[['mqHiG',1.5]]},
 {h:'ON/OFFで比べる',b:'EQのOFFとONを聴き比べよう。差はわずかで十分。±6dBまで動かしたくなったら、ミックスに戻って直す。',tab:'fx',
  cmp:[{l:'EQ OFF',s:{mqOn:0}},{l:'EQ ON',s:{mqOn:1,mqLoG:1.5,mqHiG:1.5}}],quiz:qz('明るく、厚く聞こえるのは?',2,'2が正解。ONは低域と高域が少し増えている。'),
  col:COL('EQで直す前に、トラック側で直せないか考えよう。マスターのEQは、最後の微調整。')}
 ]}),
base({id:'mr10',cat:'mr2',pre:['mr09'],title:'低域を整える(HPFとスペクトラム)',sub:'聞こえない超低域を切って、濁りを減らす',save:{name:'低域の整理',kind:'kit'},tk:TRK(SD.MS_BAD),steps:[
 {h:'SPECで見る',b:'MIXタブのMETERでSPECを選ぶと、帯域ごとの強さが見える。いちばん左(低域)に、聞こえにくい強い山がないか、見よう。',tab:'mix'},
 {h:'HPFを入れる',b:'MASTER EQをONにして、HPFを30Hzにしよう。聞こえない超低域を削る。',tab:'fx',f:[['mqOn',1],['mqHpf',30]]},
 {h:'聴き比べる',b:'HPFのOFF(20Hz)と30Hzを聴き比べよう。キックとベースが痩せないか確かめる。ほとんど変わらなければ、うまくいっている。',tab:'fx',
  cmp:[{l:'HPF OFF',s:{mqOn:1,mqHpf:20}},{l:'HPF 30 Hz',s:{mqOn:1,mqHpf:30}}],
  col:COL('HPFは高くしすぎると、低音が痩せる。40Hz以下にとどめ、低音の濁りは、トラック側のEQで直そう。')}
 ]}),
base({id:'mr11',cat:'mr2',pre:['mr09'],title:'中高域の補正(BELL)',sub:'刺さりを、小さく2点で直す',save:{name:'刺さりの補正',kind:'kit'},tk:TRK(SD.MS_BAD),steps:[
 {h:'刺さる帯域を探す',b:'今のミックスは、ハットが少し刺さる。MASTER EQをONにして、BELL2を-4dBにし、FREQを動かそう。刺さりが消える帯域を探す。',tab:'fx',f:[['mqOn',1],['mqM2G',-4]]},
 {h:'小さく直す',b:'見つけたら、BELL2のFREQを5000Hzに、量を-1.5dBにしよう。探すときは大きく動かし、直すときは小さく。',tab:'fx',f:[['mqM2F',5000],['mqM2G',-1.5]]},
 {h:'聴き比べる',b:'直す前と、直した後を聴き比べよう。刺さりが減って、他の音が変わらなければ成功。',tab:'fx',
  cmp:[{l:'直す前',s:{mqOn:0}},{l:'直した後',s:{mqOn:1,mqM2F:5000,mqM2G:-1.5}}],quiz:qz('刺さりが少ないのは?',2,'2が正解。ただし、差はわずか。大きく直すなら、ハットのトラックへ戻る。'),
  col:COL('マスターの補正は、全体にかかる。1つのトラックだけの問題は、そのトラックで直そう。')}
 ]})
 );
 SD.LESSONS.push(
base({id:'mr12',cat:'mr2',pre:['mr09','ms04'],terms:['lm_corr'],title:'ステレオ幅と相関(GONIO)',sub:'広げすぎると、モノで消える',save:{name:'広がりすぎないミックス',kind:'kit'},tk:TRK(BAD),steps:[
 {h:'広がりを見る',b:'MIXタブのMETERでGONIOを選ぶと、左右の広がりが図で見える。縦は中央、横は左右の差。横に広がりすぎると、モノで消えやすい。CORR(相関)も見よう。',tab:'mix',
  cmp:[{l:'今のミックス',tm:tm(BAD)},{l:'整ったミックス',tm:tm(FIN)}],quiz:qz('広がりすぎなのは?',1,'1が正解。コードとリードが左右に大きく振れている。')},
 {h:'PANを戻す',b:'コード(T4)のPANを0.2〜0.4に、リード(T5)のPANを-0.3〜-0.1にしよう。広げすぎを抑えると、相関が上がる。',tab:'mix',mx:[MM(4,'tPan',.2,.4),MM(5,'tPan',-.3,-.1)]},
 {h:'相関を確かめる',b:'CORRが0.3〜1に入るのを、3秒保って確かめよう。1に近いほどモノで崩れにくい。ただし、広さも大切なので、1に張りつかなくてよい。',tab:'mix',mt:[{trk:'M',m:'corr',rng:[.3,1],hold:3}],
  col:COL('広げる前に、モノで聴いて崩れないかを確かめる習慣を。広さは、足し算より引き算で。')}
 ]}),
base({id:'mr13',cat:'mr2',pre:['mr12'],title:'低域のモノ化(MONO BELOW)',sub:'低い音は中央にまとめる',save:{name:'低域をモノにまとめる',kind:'kit'},tk:TRK(BAD),steps:[
 {h:'低域は中央に',b:'低い音が左右に広がっていると、小さな機器やモノで、消えたり濁ったりしやすい。MONO BELOWは、サイドの低域だけを切って、中央にまとめる。',tab:'fx'},
 {h:'120Hzでまとめる',b:'MONO BELOWを120Hzにしよう。120Hzより低い音が、中央にまとまる。OFFと聴き比べよう。差は小さくてよい。',tab:'fx',f:[['monoBelow',120]],
  cmp:[{l:'OFF',s:{monoBelow:0}},{l:'120 Hz',s:{monoBelow:120}}],quiz:qz('低域が中央にまとまっているのは?',2,'2が正解。差は小さいので、次のMONOモニターでも確かめよう。')},
 {h:'MONOで確かめる',b:'MIXタブのMONOモニターをONにして、MONO BELOWのOFFと120Hzを聴こう。確かめたら、MONOは必ずOFFに戻す。',tab:'mix',
  col:COL('高い音まで切らないこと。120Hz付近は目安で、曲の低音の量で変わる。')}
 ]}),
base({id:'mr14',cat:'mr2',pre:['mr04'],terms:['lm_lufss','lm_lufsi'],title:'音量の時間推移',sub:'曲のどこが大きいかを、グラフで見る',save:{name:'音量の推移を見る',kind:'kit'},steps:[
 {h:'グラフを見る',b:'LUFS画面の時間推移グラフは、曲のどこが大きいかを見せる。青が【LUFS-S】(約3秒)、緑が【LUFS-I】(ここまで全体)。曲を1周流して、形を見よう。',tab:'mix'},
 {h:'押し込みの違い',b:'LIM GAINが0と+8のとき、グラフの高さがどう変わるか見よう(RESETで消せる)。高さの差が、大きさの差になる。',tab:'mix',
  cmp:[{l:'GAIN 0',s:{limGain:0}},{l:'GAIN +8',s:{limGain:8}}],quiz:qz('グラフが高くなるのは?',2,'2が正解。押し込むほど、LUFS-Sは大きくなる。')},
 {h:'形を読む',b:'急な山(サビ)や、深い谷が見えたら、それが曲の構成。全体を均したいときは、マスターではなく、各トラックの音量から直す。',tab:'mix',
  col:COL('グラフは最大6分まで。目標の帯(±1 LU)に入っているかを見る目安にもなる。')}
 ]}),
base({id:'mr15',cat:'mr2',pre:['mr05'],terms:['lm_tp','peak'],title:'トゥルーピーク(TRUE PEAK)',sub:'サンプルの間の山まで見て、天井を守る',save:{name:'TRUE PEAK ON',kind:'kit'},init:INIT({limGain:8}),steps:[
 {h:'間の山',b:'サンプルの間の山も見るのが【トゥルーピーク】。LIM GAINが+8dBのとき、TPが天井(-1dB)を超えないか、MIXタブで見よう。メーターのTPは近似で、山を低く見積もる。',tab:'mix'},
 {h:'TRUE PEAKをON',b:'TRUE PEAKをONにしよう。リミッターが、サンプルの間の山も見て、天井を守りやすくなる。ただし、完全に守れるとは限らない。OFFと聴き比べよう。',tab:'fx',f:[['limTP',1]],
  cmp:[{l:'TRUE PEAK OFF',s:{limTP:0}},{l:'TRUE PEAK ON',s:{limTP:1}}]},
 {h:'天井を-1.5に',b:'CEILINGを-1.5dBにしよう。天井に少し余裕を持たせると、変換後の割れを避けやすい。',tab:'fx',f:[['limCeil',-1.5]]},
 {h:'TPを確かめる',b:'TPが -2.1〜-1.1 に入るのを、3秒保って確かめよう。',tab:'mix',mt:[{trk:'M',m:'tp',rng:[-2.1,-1.1],hold:3}],
  col:COL('高域の多い音では、天井を少し超えることがある。ぎりぎりを狙わず、余裕を持とう。')}
 ]})
 );
 SD.LESSONS.push(
base({id:'mr16',cat:'mr3',lv:3,pre:['mr15','mr09'],terms:['mr_ms'],title:'M/S EQ(中央とサイドを別々に)',sub:'中央は締め、サイドは少し広げる',save:{name:'M/S EQ',kind:'kit'},steps:[
 {h:'ミッドとサイド',b:'【M/S】は、音を中央(ミッド)と左右の差(サイド)に分けて扱う方法。中央は低音や声、サイドは広がり。MASTER EQのMODEで、EQをかける相手を選べる。',tab:'fx'},
 {h:'MIDで低域を締める',b:'MODEをMIDにして、LOWを-1.5dBにしよう。中央の低域だけが少し減り、濁りが整う。EQがかかるのは、選んだ1つだけ。',tab:'fx',f:[['mqOn',1],['mqMode',1],['mqLoG',-1.5]]},
 {h:'SIDEで広げる',b:'LOWを0dBに戻し、MODEをSIDEにして、HIGHを+1.5dBにしよう。左右の差の高域が増えて、少し広く聞こえる。やりすぎると、モノで薄くなる。',tab:'fx',f:[['mqLoG',0],['mqMode',2],['mqHiG',1.5]]},
 {h:'STEREOと聴き比べ',b:'EQなしと、SIDEのHIGH +1.5dBを聴き比べよう。広がりの差に耳を向ける。差はわずかで十分。',tab:'fx',cmp:[{l:'EQなし',s:{mqOn:0,mqMode:0}},{l:'SIDEの高域+1.5',s:{mqOn:1,mqMode:2,mqLoG:0,mqHiG:1.5}}],quiz:qz('広く聞こえるのは?',2,'2が正解。サイドの高域が増えて、広がりが出る。')},
 {h:'モノで崩れないか',b:'CORR(相関)が0.4〜1に入るのを、3秒保って確かめよう。サイドを増やすほど相関は下がる。',tab:'mix',mt:[{trk:'M',m:'corr',rng:[.4,1],hold:3}],
  col:COL('サイドを持ち上げすぎない。広がりは、モノで聴いて崩れない範囲で。')}
]}),
base({id:'mr17',cat:'mr3',lv:3,pre:['mr06','mr15'],terms:['mr_clipper','clip'],title:'クリッパーとリミッターの分担',sub:'山を先に落とすと、リミッターの働きが減る',save:{name:'クリッパーの分担',kind:'kit'},init:INIT({limGain:8}),steps:[
 {h:'山を先に落とす',b:'【クリッパー】は、リミッターの手前で、大きな山を先に落とす。山が減ると、リミッターの働き(GR)が減る。いまのLIM GRを、MIXタブで見て覚えておこう。',tab:'mix'},
 {h:'SOFTで-3dB',b:'CLIPPERをONにして、THRESHを-3dB、SHAPEをSOFTにしよう。丸く落とすので、歪みはやさしい。LIM GRが減るのを見よう。',tab:'fx',f:[['clipOn',1],['clipThr',-3],['clipShape',0]]},
 {h:'SOFTとHARD',b:'SOFT(丸く)とHARD(平らに)を聴き比べよう。HARDは、角のあるざらつきになりやすい。どちらも、削りすぎると歪む。',tab:'fx',cmp:[{l:'SOFT',s:{clipOn:1,clipThr:-3,clipShape:0}},{l:'HARD',s:{clipOn:1,clipThr:-3,clipShape:1}}],quiz:qz('ざらつきが強いのは?',2,'2が正解。HARDは平らに切るので、角のある歪みになる。')},
 {h:'GRを0〜3dBに',b:'SHAPEをSOFTにして、THRESHやLIM GAINを動かし、LIM GRが0〜3dBに入るのを、3秒保とう。削る量を、2つで分け合う。',tab:'mix',mt:[{trk:'M',m:'grLim',rng:[0,3],hold:3}],
  col:COL('クリッパーも削りすぎると歪む。リミッターとクリッパーで、少しずつ分担するのが基本。')}
]}),
base({id:'mr18',cat:'mr3',lv:3,pre:['mr08'],terms:['mr_look'],title:'先読み(LOOKAHEAD)',sub:'短いと歪みやすく、長いと出だしがなまる',save:{name:'先読みの長さ',kind:'kit'},init:INIT({limGain:8}),steps:[
 {h:'先読みとは',b:'【ルックアヘッド】は、リミッターが音を少し先に読む長さ。短いと削り方が急で歪みやすく、長いと出だしがなまる。1msと5msを聴こう。',tab:'fx',cmp:[{l:'1 ms',s:{limLook:1}},{l:'5 ms',s:{limLook:5}}],quiz:qz('出だしがなまりやすいのは?',2,'2が正解。長く先読みするほど、アタックが丸くなる。差はわずか。')},
 {h:'キックとハットで',b:'キックの出だしと、ハットの切れ味に耳を向けて、1ms・2ms・5msを聴き比べよう。違いが分からなくても、よい。',tab:'fx',cmp:[{l:'1 ms',s:{limLook:1}},{l:'2 ms',s:{limLook:2}},{l:'5 ms',s:{limLook:5}}]},
 {h:'2msに決める',b:'LOOKAHEADを2msにしよう。歪みと、出だしの両方を、ほどよく両立する中間。曲によって変えてよい。',tab:'fx',f:[['limLook',2]],
  col:COL('差が小さい設定は、迷わず既定のままでよい。大きな違いは、ミックスやGAINで生まれる。')}
]}),
base({id:'mr19',cat:'mr3',lv:3,pre:['mr06','lm08'],terms:['mr_psr','mr_dr','lm_plr','lm_crest'],title:'音圧の代償を数値で見る(PSR・CREST)',sub:'押し込むほど、ダイナミクスの残りが減る',save:{name:'PSRとCREST',kind:'kit'},steps:[
 {h:'残り量を見る',b:'【ダイナミックレンジ】は、小さい音と大きい音の幅。【PSR】は、ピークと短い時間の大きさの差。押し込むほど、PSRとCRESTは小さくなる。',tab:'mix'},
 {h:'GAIN 0の値',b:'LIM GAINを0dBにして、曲を数秒流し、MIXタブのPSRとCRESTを読もう。この値を、押し込む前の基準として覚えておく。',tab:'mix',f:[['limGain',0]]},
 {h:'押し込んで下がる',b:'GAIN 0と+10を、音量を揃えて聴こう。+10はPSRが下がり、山が削れて平らに聞こえる。',tab:'fx',cmp:[{l:'GAIN 0',s:{limGain:0}},{l:'GAIN +10',s:{limGain:10},g:-6}],quiz:qz('PSRが小さいのは?',2,'2が正解。押し込むほど、ピークと平均の差が縮む。')},
 {h:'下げすぎない',b:'LIM GAINを動かして、PSRとCRESTをどちらも8〜14に入れ、3秒保とう。8を下回るなら、押し込みすぎ。数字は目安。',tab:'mix',mt:[{trk:'M',m:'psr',rng:[8,14],hold:3},{trk:'M',m:'crest',rng:[8,14],hold:3}],
  col:COL('数値は、聴いた印象の確認に使う。数字に合わせるために、音を悪くしないこと。')}
]})
 );
 SD.LESSONS.push(
base({id:'mr20',cat:'mr3',lv:3,pre:['mr06','lm06'],terms:['mr_norm','lm_target'],title:'再生側のラウドネス調整を体験する',sub:'大きく作っても下げられる。つぶした音は戻らない',save:{name:'再生側の調整',kind:'kit'},steps:[
 {h:'再生側で揃えられる',b:'配信先では、大きい曲の音量が自動で下げられることがある。これが【ノーマライズ】。大きく作っても、結局は揃えられる。',tab:'mix'},
 {h:'大きく作った曲',b:'LIM GAIN +2dBと+10dBで、押し込みの違いを聴こう(音量は揃えない)。+10は大きいが、再生側で下げられるかもしれない。',tab:'fx',cmp:[{l:'GAIN +2',s:{limGain:2}},{l:'GAIN +10',s:{limGain:10}}]},
 {h:'再生側の調整を使う',b:'MIXタブの「再生側: 調整して聴く」をONにして、目標を選ぼう。大きすぎる分だけ下がり、小さい曲は上がらない。聴き終えたらOFFに戻す。',tab:'mix'},
 {h:'揃えて聴く',b:'下げて音量が揃ったあと、押し込んだ曲と、控えめな曲を聴き比べよう。つぶした方が、痩せて小さく聞こえやすい。',tab:'fx',cmp:[{l:'控えめ(GAIN +2)',s:{limGain:2}},{l:'押し込み(音量を揃えた)',s:{limGain:10},g:-6}],quiz:qz('痩せて聞こえるのは?',2,'2が正解。音量を揃えると、つぶした分だけ、抑揚と迫力が減る。'),
  col:COL('-11や-19などは、聴く側の設定で、作る側の目標ではない。作るときは、聴いて自然な大きさにしよう。')}
]}),
base({id:'mr21',cat:'mr3',lv:3,pre:['mr15','mr19'],terms:['limiter','lm_target'],title:'目的別に仕上げる(PRESET)',sub:'配信向け・放送向け・押し込みを、聞いて直す',save:{name:'目的別の仕上げ',kind:'kit'},steps:[
 {h:'目的で初期値が違う',b:'PRESETには、標準・配信向け・放送向け・押し込みがある。目的で、天井・押し込み・リリースの初期値が違う。数値は案で、そのまま使わず、聞いて直す。',tab:'mix'},
 {h:'配信向けを呼ぶ',b:'PRESETで「配信向け」を呼び出そう(天井-1dB・TRUE PEAK ON・GAIN +3dB・リリース80ms)。手で合わせるなら、FXタブで同じ値にする。',tab:'fx',f:[['limCeil',-1],['limTP',1],['limGain',3],['limRel',80]]},
 {h:'押し込みと比べる',b:'配信向けと、押し込み(GAIN +8)を聴き比べよう(音量は揃えない)。大きさと引き換えに、何が減るか聴く。',tab:'fx',cmp:[{l:'配信向け',s:{limCeil:-1,limTP:1,limGain:3,limRel:80,clipOn:0}},{l:'押し込み',s:{limCeil:-1.5,limTP:1,limGain:8,limRel:60,clipOn:1,clipThr:-3,clipShape:0}}],quiz:qz('大きく聞こえるのは?',2,'2が正解。ただし、PSRやGRも見て、つぶれすぎていないか確かめよう。')},
 {h:'3つを同時に',b:'LIM GAINなどを動かして、LUFS-Sを-15〜-13、TPを-6〜-1、PSRを8以上にして、3秒保とう。そのあと、U1に保存しよう。',tab:'mix',mt:[{trk:'M',m:'lufsS',rng:[-15,-13],hold:3},{trk:'M',m:'tp',rng:[-6,-1],hold:3},{trk:'M',m:'psr',rng:[8,40],hold:3}],
  col:COL('プリセットは出発点。同じ設定でも、曲によって合う値は変わる。')}
]}),
base({id:'mr22',cat:'mr3',lv:3,pre:['mr13','ms06'],terms:['monitorchk'],title:'マスターのチェックリスト',sub:'MONO・小スピーカー・小音量・BYPASSで確かめる',save:{name:'仕上げのチェック',kind:'kit'},tk:TRK(BAD),steps:[
 {h:'①MONOで確かめる',b:'MIXタブのMONOモニターをONにして、MONOにしたとき、音が薄くなったり消えたりしないか聴こう。確かめたら、必ずOFFに戻す。',tab:'mix',cmp:[{l:'今のミックス',tm:tm(BAD)},{l:'整ったミックス',tm:tm(FIN)}],quiz:qz('モノで崩れやすいのは?',1,'1が正解。左右に広がりすぎた音は、モノにすると薄くなる。')},
 {h:'②小スピーカーで',b:'小スピーカーのモニターをONにして、低音が無くても、リードや声が聞こえるか確かめよう。確かめたら、OFFに戻す。',tab:'mix'},
 {h:'③小さい音量で',b:'音量を下げて聴こう。小さくても、主役がはっきり聞こえるか。大きい音量でしか良く聞こえないなら、バランスを見直す。',tab:'mix'},
 {h:'④BYPASSで比べる',b:'MASTER BYPASSのONとOFFで、仕上げの効果を確かめよう(音量は揃う)。良くなっていなければ、設定を戻す。確かめたら、BYPASSはOFFに戻す。',tab:'mix',
  col:COL('4つとも、確認が終わったらOFFに戻す。モニターは起動時はOFFで、MIXタブを離れても戻る。')}
]}),
base({id:'mr23',cat:'mr3',lv:3,pre:['mr04','xb06','mx13'],terms:['refmix','lm_match','lm_lufss'],title:'お手本(アプリ内)と比べる',sub:'同じ音量で、違いを1つずつ',save:{name:'お手本との比較',kind:'kit'},tk:TRK(BAD),steps:[
 {h:'音量を揃えて比べる',b:'【お手本ミックス】と比べるときも、音量を揃える。問題つきのミックスと、アプリ内のお手本を聴き比べよう(音量は揃えてある)。',tab:'mix',cmp:[{l:'自分のミックス',tm:tm(BAD)},{l:'お手本',tm:tm(FIN)}],quiz:qz('ハットが刺さって聞こえるのは?',1,'1が正解。お手本と比べると、高域の刺さりが見えてくる。')},
 {h:'SPECで差を見る',b:'METERのSPECで、低域と高域の山を、お手本と比べよう。違いは、たくさん見つかる。でも、直すのは1つだけ。',tab:'mix'},
 {h:'差を1つだけ直す',b:'いちばん気になる差を直そう。ここでは、高域の刺さり。MASTER EQをONにして、BELL2を5000Hz・-1.5dBにしよう。',tab:'fx',f:[['mqOn',1],['mqM2F',5000],['mqM2G',-1.5]]},
 {h:'大きさを合わせる',b:'LIM GAINで、LUFS-Sをお手本の大きさ(-15〜-13の目安)に合わせ、3秒保とう。自分の曲との比べ方は、MR27で扱う。',tab:'mix',mt:[{trk:'M',m:'lufsS',rng:[-15,-13],hold:3}],
  col:COL('お手本は基準であり、正解ではない。真似するより、違いに気づくために使おう。')}
]})
 );
 SD.LESSONS.push(
base({id:'mr24',cat:'mr3',lv:3,kind:'diag',pre:['mr21','mr22','mr23'],terms:['mr_ceil','mr_gain','mr_psr'],title:'総合課題: 仕上がっていないミックスを仕上げる',sub:'ここまでの判断を組み合わせて、制限内で仕上げる',save:{name:'仕上げた設定',kind:'kit'},tk:TRK(SD.MR_RAW),init:INIT({limCeil:-.1}),steps:[
 {h:'診断する',b:'このミックスは仕上がっていない。整ったミックスと聴き比べて、問題を探そう(音量は揃えない)。小さい・低域が濁る・広がりすぎ・天井が高い、の4つが疑わしい。',tab:'mix',cmp:[{l:'仕上がっていない',tm:tm(SD.MR_RAW)},{l:'整ったミックス',tm:tm(FIN)}],quiz:qz('小さく、広がりすぎなのは?',1,'1が正解。音量が小さく、コードとリードが左右に大きく振れている。')},
 {h:'ヒント1: 大きさと天井',b:'LIM GAINで、LUFS-Sを-15〜-13に近づけよう。天井(CEILING)は-0.1dBになっている。-1dB付近に下げ、TRUE PEAKもONにすると安心。',tab:'fx'},
 {h:'ヒント2: 低域',b:'低域が濁っている。MASTER EQのHPFを30Hz付近に、MONO BELOWを120Hz付近にしてみよう。直しすぎず、聴いて確かめる。',tab:'fx'},
 {h:'ヒント3: 幅',b:'広がりすぎは、マスターでは直しにくい。MIXタブで、コードとリードのPANを中央寄りに戻して、CORRを上げよう。',tab:'mix'},
 {h:'仕上げる',b:'LUFS-Sを-15〜-13、TPを-3〜-0.8、CORRを0.3〜1、PSRを8以上にして、5秒保とう。正解は1つではない。耳で確かめて、仕上げよう。',tab:'mix',mt:[{trk:'M',m:'lufsS',rng:[-15,-13],hold:5},{trk:'M',m:'tp',rng:[-3,-.8],hold:5},{trk:'M',m:'corr',rng:[.3,1],hold:5},{trk:'M',m:'psr',rng:[8,40],hold:5}],
  col:COL('保存した設定は、自分の曲の出発点になる。直したら、BYPASSで元と比べ、モニターは必ずOFFに戻す。')}
]})
 );
 SD.LESSONS.push(
base({id:'mr25',cat:'mr4',lv:3,pre:['mr22'],terms:['mr_dither'],title:'書き出しとディザ(REC)',sub:'16bitにするときの、ざらつきを目立たなくする',save:{name:'書き出しの手順',kind:'kit'},steps:[
 {h:'BYPASSをOFFに',b:'書き出す前に、MASTER BYPASSがOFFか確かめよう。ONのままだと、処理なしの音が録音される。仕上げの有無を、聴き比べて確かめる(音量は揃えてある)。',tab:'mix',cmp:[{l:'処理なし',s:{limGain:0,mcOn:0}},{l:'軽い仕上げ',s:{limGain:4,mcOn:1},g:-3}]},
 {h:'RECで録音',b:'MIXタブのRECで、16bitか24bitを選び、RECを押して曲を流し、STOPで止める。録音は曲を流した時間がかかり、最大180秒。MIXを離れると捨てられる。',tab:'mix'},
 {h:'16bitと24bit',b:'16bitは、小さな音の細かさが粗い。そのため、聞こえないほど小さい音が、ざらついて聞こえることがある。24bitは余裕があり、劣化しにくい。',tab:'mix'},
 {h:'DITHERを試す',b:'16bitでDITHERのONとOFFを録音して、とても小さい音(曲の終わりの余韻)で聴き比べよう。ノイズシェイピングは無く、効果はわずか。保存先は機種で違う。',tab:'mix',
  col:COL('書き出す前に、BYPASSがOFFか、音割れが無いかを確かめる。録音はメモリだけに置かれ、アプリを閉じると消える。')}
]}),
base({id:'mr26',cat:'mr4',lv:3,kind:'recipe',pre:['mr22','mr15'],terms:['mr_lossy'],title:'ロッシー風で確かめる(近似)',sub:'高域が減ったときの聞こえ方を確かめる',save:{name:'ロッシー風の確認',kind:'kit'},steps:[
 {h:'近似であること',b:'【ロッシー】(圧縮)された再生を、ロッシー風モニターで確かめる。ただし近似で、高域を削るだけ。実際の圧縮とは違い、にじみや出だしの乱れは再現しない。',tab:'mix'},
 {h:'OFF・中・強',b:'MIXタブのMONにあるロッシー風を、OFF・中(約16kHz)・強(約11kHz)で聴こう。ハットやリードの明るさが、どう変わるか。確かめたら、OFFに戻す。',tab:'mix'},
 {h:'MONO・小SPと併用',b:'ロッシー風を、MONOや小スピーカーと重ねて聴くと、環境が悪いときの崩れが分かる。どれも、確かめたあとは必ずOFFに戻す。',tab:'mix'},
 {h:'天井に余裕を',b:'圧縮したあとは、ピークが増えることがある。この近似では再現しないので、天井の余裕で備えよう。天井-0.5dBと、TRUE PEAK ONの-1.5dBを聴こう。',tab:'fx',cmp:[{l:'天井 -0.5 dB',s:{limCeil:-.5,limGain:8,limTP:0}},{l:'天井 -1.5 dB',s:{limCeil:-1.5,limGain:8,limTP:1}}],quiz:qz('天井に余裕があるのは?',2,'2が正解。圧縮後のピーク増加に備えて、天井は少し低くしておく。'),
  col:COL('ロッシー風は確認用の近似。実際の聞こえ方とは違うので、結果は目安として受け取ろう。')}
]}),
base({id:'mr27',cat:'mr4',lv:3,kind:'recipe',pre:['mr23','mr25'],terms:['refmix','lm_match'],title:'自分の曲を仕上げる(MASTERINGとREF)',sub:'自分の曲を、好きな曲と同じ音量で比べる',save:{name:'自分の曲の仕上げ',kind:'kit'},steps:[
 {h:'先に注意',b:'読み込むのは、自分が権利を持つ曲だけ。曲はメモリだけに置かれ、保存されず、アプリを閉じると消える。長い曲は途中で切り捨てられる。',tab:'mix'},
 {h:'MASTERINGに読み込む',b:'MIXタブのMASTERINGに、自分の2ミックスを読み込もう(300秒・40MBまで)。曲のトラックは止めておく。マスター段で、ここまでの仕上げができる。',tab:'mix'},
 {h:'REFで比べる',b:'REFに好きな曲(自分が権利を持つもの。180秒・40MBまで)を読み込み、Bで聴こう。音量は自動で揃う。REFはマスター段を通らない。',tab:'mix'},
 {h:'差を1つだけ直す',b:'AとBを切り替え、LUFSの差と聞こえ方の違いを見て、直すのは1つだけ。仕上げの有無は、聴き比べて確かめよう(音量は揃えてある)。',tab:'mix',cmp:[{l:'仕上げ前',s:{limGain:0,mcOn:0}},{l:'仕上げ後',s:{limGain:4,mcOn:1},g:-3}],
  col:COL('REFは基準であり、正解ではない。真似するより、違いに気づくために使おう。')}
]})
 );
})();
