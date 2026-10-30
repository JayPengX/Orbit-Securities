import { BONDS, bondName } from './bonds.mjs';
import * as markets from './markets.mjs';

// What the markets tab lists: curated lists by market and kind, each item
// [Yahoo symbol, Chinese name, English name, kind if not Yahoo's own]. Any
// other symbol is a search away; these carry Chinese names (Yahoo has none)
// and are what Chinese searches find.

const TW = [
  ['2330.TW', '台積電', 'TSMC'], ['2317.TW', '鴻海', 'Hon Hai (Foxconn)'], ['2454.TW', '聯發科', 'MediaTek'],
  ['2308.TW', '台達電', 'Delta Electronics'], ['2382.TW', '廣達', 'Quanta Computer'], ['2881.TW', '富邦金', 'Fubon Financial'],
  ['2882.TW', '國泰金', 'Cathay Financial'], ['2891.TW', '中信金', 'CTBC Financial'], ['2412.TW', '中華電', 'Chunghwa Telecom'],
  ['2303.TW', '聯電', 'UMC'], ['3711.TW', '日月光投控', 'ASE Technology'], ['2886.TW', '兆豐金', 'Mega Financial'],
  ['2884.TW', '玉山金', 'E.Sun Financial'], ['2892.TW', '第一金', 'First Financial'], ['5880.TW', '合庫金', 'Taiwan Cooperative Financial'],
  ['1301.TW', '台塑', 'Formosa Plastics'], ['1303.TW', '南亞', 'Nan Ya Plastics'], ['6505.TW', '台塑化', 'Formosa Petrochemical'],
  ['2002.TW', '中鋼', 'China Steel'], ['2603.TW', '長榮', 'Evergreen Marine'], ['2609.TW', '陽明', 'Yang Ming Marine'],
  ['2615.TW', '萬海', 'Wan Hai Lines'], ['2618.TW', '長榮航', 'EVA Air'], ['2610.TW', '華航', 'China Airlines'],
  ['3008.TW', '大立光', 'Largan Precision'], ['2357.TW', '華碩', 'ASUS'], ['2379.TW', '瑞昱', 'Realtek'],
  ['3231.TW', '緯創', 'Wistron'], ['6669.TW', '緯穎', 'Wiwynn'], ['2376.TW', '技嘉', 'Gigabyte'],
  ['3034.TW', '聯詠', 'Novatek'], ['2345.TW', '智邦', 'Accton'], ['3661.TW', '世芯-KY', 'Alchip'],
  ['3443.TW', '創意', 'Global Unichip'], ['2327.TW', '國巨', 'Yageo'], ['3037.TW', '欣興', 'Unimicron'],
  ['2408.TW', '南亞科', 'Nanya Technology'], ['2344.TW', '華邦電', 'Winbond'], ['2395.TW', '研華', 'Advantech'],
  ['1216.TW', '統一', 'Uni-President'], ['2912.TW', '統一超', 'President Chain Store'], ['2207.TW', '和泰車', 'Hotai Motor'],
  ['3045.TW', '台灣大', 'Taiwan Mobile'], ['1590.TW', '亞德客-KY', 'Airtac'], ['2301.TW', '光寶科', 'Lite-On'],
  ['9910.TW', '豐泰', 'Feng Tay'], ['8046.TW', '南電', 'Nan Ya PCB'], ['2356.TW', '英業達', 'Inventec'],
  ['6488.TWO', '環球晶', 'GlobalWafers'], ['5347.TWO', '世界', 'Vanguard International Semiconductor'], ['3293.TWO', '鈊象', 'IGS'],
  ['8299.TWO', '群聯', 'Phison'], ['5274.TWO', '信驊', 'ASPEED'],
  ['2880.TW', '華南金', 'Hua Nan Financial'], ['2885.TW', '元大金', 'Yuanta Financial'], ['2887.TW', '台新金', 'Taishin Financial'],
  ['2890.TW', '永豐金', 'SinoPac Financial'], ['2883.TW', '凱基金', 'KGI Financial'], ['2801.TW', '彰銀', 'Chang Hwa Bank'],
  ['2360.TW', '致茂', 'Chroma ATE'], ['2383.TW', '台光電', 'Elite Material'], ['2368.TW', '金像電', 'Gold Circuit'],
  ['3017.TW', '奇鋐', 'Asia Vital Components'], ['3653.TW', '健策', 'Jentech'], ['2449.TW', '京元電子', 'King Yuan Electronics'],
  ['6415.TW', '矽力*-KY', 'Silergy'], ['2059.TW', '川湖', 'King Slide'], ['3533.TW', '嘉澤', 'Lotes'],
  ['4938.TW', '和碩', 'Pegatron'], ['2353.TW', '宏碁', 'Acer'], ['2324.TW', '仁寶', 'Compal'],
  ['2409.TW', '友達', 'AUO'], ['3481.TW', '群創', 'Innolux'], ['1101.TW', '台泥', 'Taiwan Cement'],
  ['1102.TW', '亞泥', 'Asia Cement'], ['1326.TW', '台化', 'Formosa Chemicals'], ['1402.TW', '遠東新', 'Far Eastern New Century'],
  ['2105.TW', '正新', 'Cheng Shin Rubber'], ['2201.TW', '裕隆', 'Yulon Motor'], ['2633.TW', '台灣高鐵', 'Taiwan High Speed Rail'],
  ['2606.TW', '裕民', 'U-Ming Marine'], ['2637.TW', '慧洋-KY', 'Wisdom Marine'], ['2915.TW', '潤泰全', 'Ruentex'],
  ['9904.TW', '寶成', 'Pou Chen'], ['9921.TW', '巨大', 'Giant Manufacturing'], ['9914.TW', '美利達', 'Merida'],
  ['1476.TW', '儒鴻', 'Eclat Textile'], ['1504.TW', '東元', 'TECO Electric'], ['1519.TW', '華城', 'Fortune Electric'],
  ['1513.TW', '中興電', 'Chung-Hsin Electric'], ['1503.TW', '士電', 'Shihlin Electric'], ['4904.TW', '遠傳', 'Far EasTone'],
  ['6446.TW', '藥華藥', 'PharmaEssentia'], ['4743.TWO', '合一', 'Oneness Biotech'], ['6547.TWO', '高端疫苗', 'Medigen Vaccine'],
  ['3529.TWO', '力旺', 'eMemory'], ['6147.TWO', '頎邦', 'Chipbond'], ['8069.TWO', '元太', 'E Ink'],
  ['3105.TWO', '穩懋', 'WIN Semiconductors'], ['5483.TWO', '中美晶', 'Sino-American Silicon'], ['3324.TWO', '雙鴻', 'Auras']
];

const TW_ETF = [
  ['0050.TW', '元大台灣50', 'Yuanta Taiwan Top 50'], ['006208.TW', '富邦台50', 'Fubon Taiwan 50'], ['0056.TW', '元大高股息', 'Yuanta High Dividend'],
  ['00878.TW', '國泰永續高股息', 'Cathay ESG High Div'], ['00919.TW', '群益台灣精選高息', 'Capital TW Select High Div'],
  ['00929.TW', '復華台灣科技優息', 'Fuh Hwa TW Tech Div'], ['00940.TW', '元大台灣價值高息', 'Yuanta TW Value High Div'],
  ['00713.TW', '元大台灣高息低波', 'Yuanta High Div Low Vol'], ['00692.TW', '富邦公司治理', 'Fubon Corporate Governance'],
  ['00881.TW', '國泰台灣5G+', 'Cathay Taiwan 5G+'], ['00631L.TW', '元大台灣50正2', 'Yuanta Taiwan 50 2x', 'etf'],
  ['00632R.TW', '元大台灣50反1', 'Yuanta Taiwan 50 -1x', 'etf'], ['00646.TW', '元大S&P500', 'Yuanta S&P 500'],
  ['00662.TW', '富邦NASDAQ', 'Fubon NASDAQ-100'], ['00757.TW', '統一FANG+', 'Uni-President FANG+'], ['00830.TW', '國泰費城半導體', 'Cathay Philadelphia Semiconductor'],
  ['00635U.TW', '元大S&P黃金', 'Yuanta S&P Gold'], ['00642U.TW', '元大S&P石油', 'Yuanta S&P Oil'],
  ['00915.TW', '凱基優選高股息30', 'KGI Top 30 High Dividend'], ['00918.TW', '大華優利高填息30', 'Dah Hwa High Dividend Refill 30'],
  ['00934.TW', '中信成長高股息', 'CTBC Growth High Dividend'], ['00939.TW', '統一台灣高息動能', 'Uni-President Taiwan High Dividend Momentum'],
  ['00891.TW', '中信關鍵半導體', 'CTBC Key Semiconductor'], ['00892.TW', '富邦台灣半導體', 'Fubon Taiwan Semiconductor'],
  ['00927.TW', '群益半導體收益', 'Capital Semiconductor Income'], ['00850.TW', '元大臺灣ESG永續', 'Yuanta Taiwan ESG'],
  ['00690.TW', '兆豐藍籌30', 'Mega Blue Chip 30'], ['00733.TW', '富邦臺灣中小', 'Fubon Taiwan Mid-Small'],
  ['00905.TW', 'FT臺灣Smart', 'FT Taiwan Smart'], ['00888.TW', '永豐台灣ESG', 'SinoPac Taiwan ESG']
];

const US = [
  ['AAPL', '蘋果', 'Apple'], ['MSFT', '微軟', 'Microsoft'], ['NVDA', '輝達', 'NVIDIA'], ['GOOGL', 'Google', 'Alphabet'],
  ['AMZN', '亞馬遜', 'Amazon'], ['META', 'Meta', 'Meta Platforms'], ['TSLA', '特斯拉', 'Tesla'], ['AVGO', '博通', 'Broadcom'],
  ['TSM', '台積電 ADR', 'TSMC ADR'], ['BRK-B', '波克夏', 'Berkshire Hathaway B'], ['JPM', '摩根大通', 'JPMorgan Chase'],
  ['V', 'Visa', 'Visa'], ['MA', '萬事達卡', 'Mastercard'], ['LLY', '禮來', 'Eli Lilly'], ['UNH', '聯合健康', 'UnitedHealth'],
  ['JNJ', '嬌生', 'Johnson & Johnson'], ['XOM', '埃克森美孚', 'Exxon Mobil'], ['WMT', '沃爾瑪', 'Walmart'], ['COST', '好市多', 'Costco'],
  ['PG', '寶僑', 'Procter & Gamble'], ['KO', '可口可樂', 'Coca-Cola'], ['PEP', '百事', 'PepsiCo'], ['MCD', '麥當勞', "McDonald's"],
  ['NKE', 'Nike', 'Nike'], ['DIS', '迪士尼', 'Disney'], ['NFLX', '網飛', 'Netflix'], ['AMD', '超微', 'AMD'], ['INTC', '英特爾', 'Intel'],
  ['QCOM', '高通', 'Qualcomm'], ['MU', '美光', 'Micron'], ['ORCL', '甲骨文', 'Oracle'], ['CRM', 'Salesforce', 'Salesforce'],
  ['ADBE', 'Adobe', 'Adobe'], ['PLTR', 'Palantir', 'Palantir'], ['UBER', 'Uber', 'Uber'], ['SBUX', '星巴克', 'Starbucks'],
  ['BA', '波音', 'Boeing'], ['COIN', 'Coinbase', 'Coinbase'], ['MSTR', 'Strategy', 'Strategy'],
  ['BABA', '阿里巴巴 ADR', 'Alibaba ADR'], ['ASML', '艾司摩爾 ADR', 'ASML ADR'], ['ARM', '安謀', 'Arm Holdings'],
  ['BAC', '美國銀行', 'Bank of America'], ['WFC', '富國銀行', 'Wells Fargo'], ['GS', '高盛', 'Goldman Sachs'], ['MS', '摩根士丹利', 'Morgan Stanley'],
  ['AXP', '美國運通', 'American Express'], ['PYPL', 'PayPal', 'PayPal'], ['HD', '家得寶', 'Home Depot'], ['LOW', '勞氏', "Lowe's"],
  ['TGT', '目標百貨', 'Target'], ['ABBV', '艾伯維', 'AbbVie'], ['MRK', '默克', 'Merck'], ['PFE', '輝瑞', 'Pfizer'],
  ['TMO', '賽默飛世爾', 'Thermo Fisher'], ['ABT', '亞培', 'Abbott'], ['CVX', '雪佛龍', 'Chevron'], ['CAT', '開拓重工', 'Caterpillar'],
  ['GE', '奇異航太', 'GE Aerospace'], ['LMT', '洛克希德馬丁', 'Lockheed Martin'], ['RTX', 'RTX', 'RTX'], ['HON', '漢威聯合', 'Honeywell'],
  ['UPS', '優比速', 'UPS'], ['T', 'AT&T', 'AT&T'], ['VZ', '威訊', 'Verizon'], ['IBM', 'IBM', 'IBM'], ['CSCO', '思科', 'Cisco'],
  ['TXN', '德州儀器', 'Texas Instruments'], ['AMAT', '應用材料', 'Applied Materials'], ['LRCX', '科林研發', 'Lam Research'],
  ['KLAC', '科磊', 'KLA'], ['MRVL', '邁威爾', 'Marvell'], ['SMCI', '美超微', 'Super Micro Computer'], ['DELL', '戴爾', 'Dell'],
  ['NOW', 'ServiceNow', 'ServiceNow'], ['SNOW', 'Snowflake', 'Snowflake'], ['SHOP', 'Shopify', 'Shopify'], ['ABNB', 'Airbnb', 'Airbnb'],
  ['SPOT', 'Spotify', 'Spotify'], ['RBLX', 'Roblox', 'Roblox'], ['HOOD', 'Robinhood', 'Robinhood'], ['RIVN', 'Rivian', 'Rivian'],
  ['NIO', '蔚來 ADR', 'NIO ADR'], ['PDD', '拼多多 ADR', 'PDD ADR'], ['SONY', '索尼 ADR', 'Sony ADR'], ['TM', '豐田 ADR', 'Toyota ADR']
];

const US_ETF = [
  ['SPY', 'SPDR 標普500', 'SPDR S&P 500'], ['VOO', 'Vanguard 標普500', 'Vanguard S&P 500'], ['IVV', 'iShares 標普500', 'iShares Core S&P 500'],
  ['QQQ', '那斯達克100', 'Invesco QQQ (Nasdaq-100)'], ['VTI', '美國全市場', 'Vanguard Total Stock Market'], ['VT', '全世界股票', 'Vanguard Total World Stock'],
  ['VXUS', '美國以外全球', 'Vanguard Total International'], ['SCHD', '美國高股息', 'Schwab US Dividend Equity'], ['VYM', 'Vanguard 高股息', 'Vanguard High Div Yield'],
  ['DIA', '道瓊工業', 'SPDR Dow Jones'], ['IWM', '羅素2000小型股', 'iShares Russell 2000'], ['SOXX', '費城半導體', 'iShares Semiconductor'],
  ['SMH', 'VanEck 半導體', 'VanEck Semiconductor'], ['XLK', '科技類股', 'Technology Select Sector'], ['XLF', '金融類股', 'Financial Select Sector'],
  ['XLE', '能源類股', 'Energy Select Sector'], ['VNQ', '美國房地產', 'Vanguard Real Estate'], ['ARKK', '方舟創新', 'ARK Innovation'],
  ['EWT', '台灣 (iShares)', 'iShares MSCI Taiwan'], ['EWJ', '日本 (iShares)', 'iShares MSCI Japan'], ['EEM', '新興市場', 'iShares MSCI Emerging Markets'],
  ['IBIT', '比特幣現貨 ETF', 'iShares Bitcoin Trust'], ['TQQQ', '那斯達克100 三倍', 'ProShares UltraPro QQQ (3x)'], ['SQQQ', '那斯達克100 反三倍', 'UltraPro Short QQQ (-3x)'],
  ['QQQM', '那斯達克100 (小額)', 'Invesco NASDAQ 100 (QQQM)'], ['SPLG', 'SPDR 標普500 (小額)', 'SPDR Portfolio S&P 500'], ['VUG', 'Vanguard 成長股', 'Vanguard Growth'],
  ['VTV', 'Vanguard 價值股', 'Vanguard Value'], ['VIG', 'Vanguard 股利成長', 'Vanguard Dividend Appreciation'], ['JEPI', 'JPMorgan 股票溢價收益', 'JPMorgan Equity Premium Income'],
  ['JEPQ', 'JPMorgan 那斯達克溢價收益', 'JPMorgan Nasdaq Equity Premium Income'], ['XLV', '醫療保健類股', 'Health Care Select Sector'], ['XLY', '非必需消費類股', 'Consumer Discretionary Select Sector'],
  ['XLP', '必需消費類股', 'Consumer Staples Select Sector'], ['XLI', '工業類股', 'Industrial Select Sector'], ['XLU', '公用事業類股', 'Utilities Select Sector'],
  ['ICLN', '全球潔淨能源', 'iShares Global Clean Energy'], ['BOTZ', '機器人與人工智慧', 'Global X Robotics & AI'], ['INDA', '印度 (iShares)', 'iShares MSCI India'],
  ['MCHI', '中國 (iShares)', 'iShares MSCI China'], ['EWY', '南韓 (iShares)', 'iShares MSCI South Korea'], ['VGK', '歐洲股票', 'Vanguard FTSE Europe'],
  ['VWO', '新興市場 (Vanguard)', 'Vanguard FTSE Emerging Markets'], ['ETHA', '以太幣現貨 ETF', 'iShares Ethereum Trust']
];

const BOND_ETFS = [
  ['00679B.TWO', '元大美債20年', 'Yuanta US Treasury 20+ Year'], ['00687B.TWO', '國泰20年美債', 'Cathay US Treasury 20+ Year'],
  ['00937B.TWO', '群益ESG投等債20+', 'Capital ESG IG Corporate 20+'], ['00720B.TWO', '元大投資級公司債', 'Yuanta IG Corporate Bond'],
  ['TLT', '美國20年以上公債', 'iShares 20+ Year Treasury', 'bond'], ['IEF', '美國7–10年公債', 'iShares 7-10 Year Treasury', 'bond'],
  ['SHY', '美國1–3年公債', 'iShares 1-3 Year Treasury', 'bond'], ['SGOV', '美國短期國庫券', 'iShares 0-3 Month Treasury', 'bond'],
  ['BND', '美國整體債券', 'Vanguard Total Bond Market', 'bond'], ['AGG', 'iShares 美國綜合債', 'iShares Core US Agg Bond', 'bond'],
  ['LQD', '投資級公司債', 'iShares IG Corporate Bond', 'bond'], ['HYG', '高收益債', 'iShares High Yield Corp Bond', 'bond'],
  ['TIP', '抗通膨公債', 'iShares TIPS Bond', 'bond'], ['EMB', '新興市場債', 'iShares JPM EM Bond', 'bond'], ['BNDX', '國際債券', 'Vanguard Total Intl Bond', 'bond'],
  ['^IRX', '美債13週殖利率', 'US 3-month yield'], ['^FVX', '美債5年殖利率', 'US 5-year yield'],
  ['^TNX', '美債10年殖利率', 'US 10-year yield'], ['^TYX', '美債30年殖利率', 'US 30-year yield']
];

const JP = [
  ['7203.T', '豐田汽車', 'Toyota'], ['6758.T', '索尼', 'Sony'], ['9984.T', '軟銀集團', 'SoftBank Group'], ['8306.T', '三菱日聯金融', 'MUFG'],
  ['6861.T', '基恩斯', 'Keyence'], ['7974.T', '任天堂', 'Nintendo'], ['9983.T', '迅銷 (Uniqlo)', 'Fast Retailing (Uniqlo)'],
  ['8035.T', '東京威力科創', 'Tokyo Electron'], ['6501.T', '日立', 'Hitachi'], ['7267.T', '本田', 'Honda'], ['4063.T', '信越化學', 'Shin-Etsu Chemical'],
  ['6098.T', 'Recruit', 'Recruit Holdings'], ['8058.T', '三菱商事', 'Mitsubishi Corp'], ['9432.T', 'NTT', 'NTT'],
  ['1321.T', '日經225 ETF', 'Nikkei 225 ETF'], ['1306.T', '東證指數 ETF', 'TOPIX ETF']
];

const HK_CN = [
  ['0700.HK', '騰訊', 'Tencent'], ['9988.HK', '阿里巴巴', 'Alibaba'], ['3690.HK', '美團', 'Meituan'], ['1810.HK', '小米', 'Xiaomi'],
  ['9618.HK', '京東', 'JD.com'], ['1211.HK', '比亞迪', 'BYD'], ['0005.HK', '滙豐控股', 'HSBC'], ['0941.HK', '中國移動', 'China Mobile'],
  ['1299.HK', '友邦保險', 'AIA'], ['0388.HK', '香港交易所', 'HKEX'], ['2318.HK', '中國平安', 'Ping An'], ['2800.HK', '盈富基金', 'Tracker Fund of Hong Kong'],
  ['2828.HK', '恒生中國企業 ETF', 'Hang Seng China Enterprises ETF'], ['3033.HK', '南方恒生科技 ETF', 'CSOP Hang Seng Tech ETF'],
  ['600519.SS', '貴州茅台', 'Kweichow Moutai'], ['000333.SZ', '美的集團', 'Midea Group'], ['601318.SS', '中國平安 (A股)', 'Ping An (A)'],
  ['000858.SZ', '五糧液', 'Wuliangye'], ['600036.SS', '招商銀行', 'China Merchants Bank'], ['510300.SS', '滬深300 ETF', 'CSI 300 ETF']
];

const KR = [
  ['005930.KS', '三星電子', 'Samsung Electronics'], ['000660.KS', 'SK 海力士', 'SK Hynix'], ['005380.KS', '現代汽車', 'Hyundai Motor'],
  ['373220.KS', 'LG 新能源', 'LG Energy Solution'], ['035420.KS', 'Naver', 'Naver'], ['035720.KS', 'Kakao', 'Kakao']
];

const EU = [
  ['ASML.AS', '艾司摩爾', 'ASML'], ['SAP.DE', 'SAP', 'SAP'], ['SIE.DE', '西門子', 'Siemens'], ['ALV.DE', '安聯', 'Allianz'],
  ['BMW.DE', 'BMW', 'BMW'], ['MBG.DE', '賓士集團', 'Mercedes-Benz'], ['MC.PA', 'LVMH', 'LVMH'], ['RMS.PA', '愛馬仕', 'Hermès'],
  ['OR.PA', '萊雅', "L'Oréal"], ['AIR.PA', '空中巴士', 'Airbus'], ['TTE.PA', '道達爾能源', 'TotalEnergies'], ['RACE.MI', '法拉利', 'Ferrari'],
  ['ITX.MC', 'Inditex (Zara)', 'Inditex (Zara)'], ['NESN.SW', '雀巢', 'Nestlé'], ['UBSG.SW', '瑞銀', 'UBS'], ['NOVN.SW', '諾華', 'Novartis'],
  ['NOVO-B.CO', '諾和諾德', 'Novo Nordisk'], ['SHEL.L', '殼牌', 'Shell'], ['AZN.L', '阿斯特捷利康', 'AstraZeneca'], ['HSBA.L', '滙豐 (倫敦)', 'HSBC (London)'],
  ['ULVR.L', '聯合利華', 'Unilever'], ['RR.L', '勞斯萊斯', 'Rolls-Royce'], ['CSPX.L', '標普500 (倫敦 iShares)', 'iShares Core S&P 500 (London)'], ['VWRA.L', '全世界股票 (倫敦)', 'Vanguard FTSE All-World (London)']
];

const OTHER = [
  ['SHOP.TO', 'Shopify', 'Shopify'], ['RY.TO', '加拿大皇家銀行', 'Royal Bank of Canada'], ['BHP.AX', '必和必拓', 'BHP'],
  ['CBA.AX', '澳洲聯邦銀行', 'Commonwealth Bank'], ['D05.SI', '星展銀行', 'DBS'], ['RELIANCE.NS', '信實工業', 'Reliance Industries'],
  ['INFY.NS', '印孚瑟斯', 'Infosys'], ['TCS.NS', '塔塔諮詢', 'Tata Consultancy Services'],
  ['HDFCBANK.NS', 'HDFC 銀行', 'HDFC Bank'], ['TD.TO', '道明銀行', 'TD Bank'], ['ENB.TO', 'Enbridge', 'Enbridge'],
  ['CSL.AX', 'CSL', 'CSL'], ['O39.SI', '華僑銀行', 'OCBC'], ['U11.SI', '大華銀行', 'UOB'], ['C38U.SI', '凱德綜合商業信託', 'CapitaLand Integrated Commercial Trust'],
  ['VALE', '淡水河谷 ADR', 'Vale ADR'], ['MELI', 'MercadoLibre', 'MercadoLibre'], ['NU', 'Nu Holdings', 'Nu Holdings']
];

// Taiwan's best-known funds of its own fund houses (境內基金, SITCA's
// 基金統編 + .TWF); the 全部 list has every one.
const FUNDS = [
  ['18480065.TWF', '安聯台灣科技基金', 'Allianz Taiwan Technology', 'fund'], ['92002244.TWF', '統一黑馬基金', 'Uni-President Black Horse', 'fund'],
  ['97984293A.TWF', '群益馬拉松基金', 'Capital Marathon', 'fund'], ['19330754A.TWF', '野村優質基金', 'Nomura Quality (accumulating)', 'fund'],
  ['17604124A.TWF', '安聯台灣大壩基金', 'Allianz Taiwan Big Cap', 'fund'], ['21759676A.TWF', '復華全方位基金', 'Fuh Hwa All-Round', 'fund'],
  ['73990253.TWF', '統一奔騰基金', 'Uni-President Ben Teng', 'fund'], ['01032162.TWF', '摩根台灣增長基金', 'JPMorgan Taiwan Growth', 'fund'],
  ['15733973A.TWF', '富蘭克林華美第一富基金', 'Franklin Templeton SinoAm First Rich', 'fund'], ['18036846.TWF', '摩根平衡基金', 'JPMorgan Balanced', 'fund'],
  ['20081331.TWF', '元大萬泰貨幣市場基金', 'Yuanta Wan Tai Money Market', 'fund'], ['18034853.TWF', '國泰台灣貨幣市場基金', 'Cathay Taiwan Money Market', 'fund']
];

const CRYPTO = [
  ['BTC-USD', '比特幣', 'Bitcoin'], ['ETH-USD', '以太幣', 'Ethereum'], ['SOL-USD', 'Solana', 'Solana'], ['BNB-USD', '幣安幣', 'BNB'],
  ['XRP-USD', '瑞波幣', 'XRP'], ['DOGE-USD', '狗狗幣', 'Dogecoin'], ['ADA-USD', 'Cardano', 'Cardano'], ['TRX-USD', '波場', 'TRON'],
  ['AVAX-USD', 'Avalanche', 'Avalanche'], ['LINK-USD', 'Chainlink', 'Chainlink'], ['DOT-USD', 'Polkadot', 'Polkadot'],
  ['LTC-USD', '萊特幣', 'Litecoin'], ['BCH-USD', '比特幣現金', 'Bitcoin Cash'], ['SHIB-USD', '柴犬幣', 'Shiba Inu'],
  ['USDT-USD', '泰達幣 (穩定幣)', 'Tether (stablecoin)'], ['USDC-USD', 'USDC (穩定幣)', 'USD Coin (stablecoin)']
];

const METALS = [
  ['XAU', '黃金存摺', 'Gold passbook', 'metal'], ['XAG', '白銀存摺', 'Silver passbook', 'metal'],
  ['GLD', '黃金 ETF (SPDR)', 'SPDR Gold Shares'], ['SLV', '白銀 ETF', 'iShares Silver Trust'], ['USO', '原油 ETF', 'United States Oil Fund'],
  ['DBA', '農產品 ETF', 'Invesco DB Agriculture'], ['CPER', '銅 ETF', 'United States Copper Index'],
  ['GC=F', '黃金期貨', 'Gold futures'], ['SI=F', '白銀期貨', 'Silver futures'], ['CL=F', 'WTI 原油期貨', 'WTI crude futures'],
  ['BZ=F', '布蘭特原油期貨', 'Brent crude futures'], ['NG=F', '天然氣期貨', 'Natural gas futures'], ['HG=F', '銅期貨', 'Copper futures'],
  ['ZC=F', '玉米期貨', 'Corn futures'], ['ZW=F', '小麥期貨', 'Wheat futures'], ['KC=F', '咖啡期貨', 'Coffee futures']
];

// Currency pairs: the first currency priced in the second (EUR/USD: US$ per
// euro), traded in the second.
const FX = [
  ['USDTWD=X', '美元/新台幣', 'USD/TWD', 'fx'], ['JPYTWD=X', '日圓/新台幣', 'JPY/TWD', 'fx'], ['EURTWD=X', '歐元/新台幣', 'EUR/TWD', 'fx'],
  ['EURUSD=X', '歐元/美元', 'EUR/USD', 'fx'], ['USDJPY=X', '美元/日圓', 'USD/JPY', 'fx'], ['GBPUSD=X', '英鎊/美元', 'GBP/USD', 'fx'],
  ['AUDUSD=X', '澳幣/美元', 'AUD/USD', 'fx'], ['USDCAD=X', '美元/加幣', 'USD/CAD', 'fx'], ['USDCHF=X', '美元/瑞郎', 'USD/CHF', 'fx'],
  ['NZDUSD=X', '紐幣/美元', 'NZD/USD', 'fx'], ['USDCNY=X', '美元/人民幣', 'USD/CNY', 'fx'], ['USDHKD=X', '美元/港幣', 'USD/HKD', 'fx'],
  ['EURJPY=X', '歐元/日圓', 'EUR/JPY', 'fx'], ['GBPJPY=X', '英鎊/日圓', 'GBP/JPY', 'fx'], ['AUDJPY=X', '澳幣/日圓', 'AUD/JPY', 'fx'],
  ['EURGBP=X', '歐元/英鎊', 'EUR/GBP', 'fx'], ['USDKRW=X', '美元/韓元', 'USD/KRW', 'fx'], ['USDSGD=X', '美元/新加坡幣', 'USD/SGD', 'fx']
];

// TAIFEX's TAIEX futures: each size's two nearest months (an older kit: none).
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FUTS = markets.futureMonths
  ? ['TX', 'MTX', 'TMF'].flatMap(code =>
      markets.futureMonths(code).map(symbol => {
        const f = markets.futureOf(symbol);
        return [symbol, `${f.zh} ${f.month}月`, `${f.en} ${MONTH_EN[f.month - 1]}`, 'fut'];
      })
    )
  : [];

// TAIFEX's 股票期貨 and ETF期貨 (an older kit: none): each contract's nearest
// month, the best-known stocks' first (in 台股's order), a 小型 after its full size.
const twRank = new Map(TW.map(([s], i) => [s, i]));
const SSF = (markets.stockFutureCodes?.() || [])
  .map(code => markets.futureMonths(code, Date.now(), 1)[0])
  .filter(Boolean)
  .map(symbol => ({ symbol, f: markets.futureOf(symbol) }))
  .sort((a, b) => (twRank.get(a.f.underlying) ?? 1e4) - (twRank.get(b.f.underlying) ?? 1e4) || a.f.underlying.localeCompare(b.f.underlying) || b.f.mult - a.f.mult)
  .map(({ symbol, f }) => [[symbol, `${f.zh} ${f.month}月`, `${f.en} ${MONTH_EN[f.month - 1]}`, 'fut'], f.etf]);
const SSF_STOCK = SSF.filter(([, etf]) => !etf).map(([item]) => item);
const SSF_ETF = SSF.filter(([, etf]) => etf).map(([item]) => item);

const GOV_BONDS = Object.values(BONDS).map(b => [b.id, bondName(b, 'zh'), bondName(b, 'en'), 'govbond']);

const INDEXES = [
  ['^TWII', '台灣加權指數', 'TAIEX'], ['^GSPC', '標普500', 'S&P 500'], ['^IXIC', '那斯達克', 'Nasdaq'],
  ['^DJI', '道瓊工業', 'Dow Jones'], ['^SOX', '費城半導體', 'PHLX Semis'], ['^RUT', '羅素2000', 'Russell 2000'], ['^VIX', 'VIX 恐慌指數', 'VIX'],
  ['^N225', '日經225', 'Nikkei 225'], ['^HSI', '恒生指數', 'Hang Seng'], ['000001.SS', '上證指數', 'Shanghai'], ['^KS11', '韓國綜合', 'KOSPI'],
  ['^GDAXI', '德國DAX', 'DAX'], ['^FTSE', '英國富時100', 'FTSE 100'], ['^FCHI', '法國CAC 40', 'CAC 40'], ['^STOXX50E', '歐洲斯托克50', 'Euro Stoxx 50'],
  ['^BSESN', '印度孟買 Sensex', 'BSE Sensex'], ['^AXJO', '澳洲 ASX 200', 'ASX 200']
];

export const CATEGORIES = [
  { id: 'tw', zh: '台股', en: 'Taiwan', icon: '🇹🇼', items: TW },
  { id: 'twetf', zh: '台灣 ETF', en: 'Taiwan ETFs', icon: '🧺', items: TW_ETF },
  { id: 'us', zh: '美股', en: 'US stocks', icon: '🇺🇸', items: US },
  { id: 'usetf', zh: '美國 ETF', en: 'US ETFs', icon: '📦', items: US_ETF },
  { id: 'govbond', zh: '公債', en: 'Government bonds', icon: '🏛️', items: GOV_BONDS },
  { id: 'bond', zh: '債券 ETF', en: 'Bond ETFs', icon: '📜', items: BOND_ETFS },
  { id: 'crypto', zh: '加密貨幣', en: 'Crypto', icon: '🪙', items: CRYPTO },
  { id: 'fx', zh: '外匯', en: 'Forex', icon: '💱', items: FX },
  { id: 'metal', zh: '黃金・原物料', en: 'Gold & commodities', icon: '🥇', items: METALS },
  { id: 'jp', zh: '日股', en: 'Japan', icon: '🇯🇵', items: JP },
  { id: 'hk', zh: '港股・陸股', en: 'HK & China', icon: '🇭🇰', items: HK_CN },
  { id: 'kr', zh: '韓股', en: 'Korea', icon: '🇰🇷', items: KR },
  { id: 'eu', zh: '歐股', en: 'Europe', icon: '🇪🇺', items: EU },
  { id: 'fund', zh: '基金', en: 'Funds', icon: '🗂️', items: FUNDS },
  ...(FUTS.length ? [{ id: 'fut', zh: '期貨', en: 'Futures', icon: '📉', items: FUTS }] : []),
  ...(SSF_STOCK.length ? [{ id: 'ssf', zh: '個股期貨', en: 'Stock futures', icon: '📉', items: SSF_STOCK }, { id: 'etffut', zh: 'ETF 期貨', en: 'ETF futures', icon: '📉', items: SSF_ETF }] : []),
  // (Its chain is built in the app around the index: app.js optCat.)
  ...(markets.optionMonths ? [{ id: 'opt', zh: '選擇權', en: 'Options', icon: '🎯', items: [] }] : []),
  { id: 'other', zh: '其他市場', en: 'More markets', icon: '🌏', items: OTHER },
  { id: 'index', zh: '指數', en: 'Indexes', icon: '📈', items: INDEXES }
];

// 市場's two levels: a product, as a Taiwan broker's app sells them (its own
// exchanges' securities, TAIFEX's futures and options, 複委託 abroad, funds,
// bonds, forex, gold, crypto), and its lists. A list is the curated picks
// (`cat`: a list above, `only`: which of its symbols) and then everything its
// market lists (`listing`: the file, `kinds`: its kind letters, `only` again),
// or a view of its own (`view`: the options chain). Home's product tiles are
// these, in this order.
const tw = s => /\.TW$/.test(s);
const two = s => /\.TWO$/.test(s);
const GOLD = new Set(['XAU', 'XAG', 'GLD', 'SLV', '00635U.TW']);
const PRODUCT_LIST = [
  {
    id: 'tw', zh: '台股', en: 'Taiwan', short: { zh: '台股', en: 'Taiwan' },
    subs: [
      { id: 'twse', zh: '上市', en: 'TWSE', cat: 'tw', only: tw, listing: 'tw', kinds: 's' },
      { id: 'tpex', zh: '上櫃', en: 'TPEx', cat: 'tw', only: two, listing: 'tw', kinds: 's' },
      { id: 'esb', zh: '興櫃', en: 'Emerging', listing: 'tw', kinds: 'm' },
      { id: 'twetf', zh: 'ETF', en: 'ETFs', cat: 'twetf', listing: 'tw', kinds: 'en' },
      { id: 'warrant', zh: '權證', en: 'Warrants', listing: 'tww', kinds: 'w' },
      { id: 'cbbc', zh: '牛熊證', en: 'Bull/bear', listing: 'tww', kinds: 'x' },
      { id: 'cb', zh: '可轉債', en: 'Convertibles', listing: 'tw', kinds: 'c' },
      { id: 'twmore', zh: '特別股・REITs', en: 'Preferred · REITs', listing: 'tw', kinds: 'prd' }
    ]
  },
  {
    id: 'deriv', zh: '期貨・選擇權', en: 'Futures · options', short: { zh: '期權', en: 'F&O' },
    subs: [
      { id: 'fut', zh: '台指期貨', en: 'TAIEX futures', cat: 'fut' },
      ...(SSF_STOCK.length ? [{ id: 'ssf', zh: '個股期貨', en: 'Stock futures', cat: 'ssf' }, { id: 'etffut', zh: 'ETF 期貨', en: 'ETF futures', cat: 'etffut' }] : []),
      { id: 'opt', zh: '台指選擇權', en: 'TAIEX options', view: 'opt' }
    ]
  },
  {
    id: 'intl', zh: '複委託', en: 'Overseas', short: { zh: '複委託', en: 'Overseas' },
    subs: [
      { id: 'us', zh: '美股', en: 'US', cat: 'us', listing: 'us', kinds: 's' },
      { id: 'usetf', zh: '美國 ETF', en: 'US ETFs', cat: 'usetf', listing: 'us', kinds: 'e' },
      { id: 'jp', zh: '日股', en: 'Japan', cat: 'jp', listing: 'jp', kinds: 'ser' },
      { id: 'hk', zh: '港股', en: 'Hong Kong', cat: 'hk', only: s => s.endsWith('.HK'), listing: 'hk', kinds: 'ser' },
      { id: 'cn', zh: '陸股', en: 'China A', cat: 'hk', only: s => /\.S[SZ]$/.test(s) },
      { id: 'kr', zh: '韓股', en: 'Korea', cat: 'kr' },
      { id: 'eu', zh: '歐股', en: 'Europe', cat: 'eu' },
      { id: 'other', zh: '其他', en: 'More', cat: 'other' }
    ]
  },
  {
    id: 'fund', zh: '基金', en: 'Funds', short: { zh: '基金', en: 'Funds' },
    subs: [
      ['q', '股票型', 'Equity'], ['y', '債券型', 'Bond'], ['l', '平衡型', 'Balanced'], ['u', '多重資產', 'Multi-asset'],
      ['o', '組合型', 'Fund of funds'], ['i', '指數型', 'Index'], ['k', '貨幣市場', 'Money market'], ['z', '其他', 'Other']
    ].map(([k, zh, en]) => ({ id: `fund${k}`, zh, en, cat: 'fund', listing: 'fund', kinds: k }))
  },
  {
    id: 'bonds', zh: '債券', en: 'Bonds', short: { zh: '債券', en: 'Bonds' },
    subs: [
      { id: 'govbond', zh: '公債', en: 'Government', cat: 'govbond' },
      { id: 'twbond', zh: '台灣債券 ETF', en: 'Taiwan bond ETFs', cat: 'bond', only: two, listing: 'tw', kinds: 'b' },
      { id: 'usbond', zh: '美國債券 ETF', en: 'US bond ETFs', cat: 'bond', only: s => !/\.TWO$|^\^/.test(s) }
    ]
  },
  { id: 'fx', zh: '外匯', en: 'Forex', short: { zh: '外匯', en: 'Forex' }, subs: [{ id: 'fx', zh: '外匯', en: 'Forex', cat: 'fx' }] },
  {
    id: 'gold', zh: '黃金・原物料', en: 'Gold · commodities', short: { zh: '黃金', en: 'Gold' },
    subs: [
      { id: 'gold', zh: '黃金・白銀', en: 'Gold · silver', cat: 'metal', only: s => GOLD.has(s), extra: ['00635U.TW'] },
      { id: 'commodity', zh: '原物料', en: 'Commodities', cat: 'metal', only: s => !GOLD.has(s), extra: ['00642U.TW'] }
    ]
  },
  { id: 'crypto', zh: '加密貨幣', en: 'Crypto', short: { zh: '加密', en: 'Crypto' }, subs: [{ id: 'crypto', zh: '加密貨幣', en: 'Crypto', cat: 'crypto' }] }
];
// In the order people use them (Jay 2026-10-23: 期權 is no one's first stop):
// Taiwan's shares and ETFs, overseas shares, funds, then the rest; futures and options last.
const PRODUCT_ORDER = ['tw', 'intl', 'fund', 'fx', 'gold', 'bonds', 'crypto', 'deriv'];
export const PRODUCTS = PRODUCT_ORDER.map(id => PRODUCT_LIST.find(p => p.id === id));
export const SUBS = new Map(PRODUCTS.flatMap(p => p.subs.map(s => [s.id, { ...s, product: p.id }])));
// A list's curated picks: its list's symbols it takes, then its extras.
export const subPicks = sub => [...new Set([...(CATEGORIES.find(c => c.id === sub.cat)?.items || []).map(i => i[0]).filter(s => !sub.only || sub.only(s)), ...(sub.extra || [])])];
// Each country's market one tap from 總覽 (Jay 2026-10-30: they were all
// under 複委託): its flag, the list it opens (`sub`, or Taiwan's whole
// product) and the index that says how its day is going.
export const COUNTRIES = [
  { id: 'tw', flag: 'TW', zh: '台股', en: 'Taiwan', product: 'tw', index: '^TWII' },
  { id: 'us', flag: 'US', zh: '美股', en: 'US', sub: 'us', index: '^GSPC' },
  { id: 'jp', flag: 'JP', zh: '日股', en: 'Japan', sub: 'jp', index: '^N225' },
  { id: 'hk', flag: 'HK', zh: '港股', en: 'Hong Kong', sub: 'hk', index: '^HSI' },
  { id: 'cn', flag: 'CN', zh: '陸股', en: 'China', sub: 'cn', index: '000001.SS' },
  { id: 'kr', flag: 'KR', zh: '韓股', en: 'Korea', sub: 'kr', index: '^KS11' },
  { id: 'eu', flag: 'EU', zh: '歐股', en: 'Europe', sub: 'eu', index: '^STOXX50E' }
];
// A 複委託 list's flag (its chip's), by its id.
export const SUB_FLAGS = { us: 'US', usetf: 'US', jp: 'JP', hk: 'HK', cn: 'CN', kr: 'KR', eu: 'EU' };
// 總覽's indexes: the world's, then the yields.
export const MARKET_INDEXES = [...INDEXES.map(i => i[0]), '^IRX', '^FVX', '^TNX', '^TYX'];

// The overview strip at the top of the markets tab.
export const OVERVIEW = ['^TWII', '^GSPC', '^IXIC', '^SOX', '^N225', '^HSI', 'BTC-USD', 'USDTWD=X', 'XAU', '^TNX'];

const INFO = new Map();
for (const c of CATEGORIES) for (const [symbol, zh, en, kind] of c.items) if (!INFO.has(symbol)) INFO.set(symbol, { symbol, zh, en, kind, category: c.id });

export const catalogInfo = symbol => INFO.get(symbol) || null;

// Watch-only things (indexes, futures) point to something that tracks them.
export const TRACKERS = {
  '^TWII': ['0050.TW', '006208.TW'], '^GSPC': ['VOO', 'SPY', '00646.TW'], '^IXIC': ['QQQ', '00662.TW'],
  '^DJI': ['DIA'], '^SOX': ['SOXX', '00830.TW'], '^RUT': ['IWM'], '^N225': ['1321.T', 'EWJ'], '^HSI': ['2800.HK'], '000001.SS': ['510300.SS'],
  '^KS11': ['005930.KS'], '^GDAXI': ['SAP.DE'], '^FTSE': ['SHEL.L'], '^STOXX50E': ['ASML.AS'], '^VIX': [], '^BSESN': ['RELIANCE.NS'], '^AXJO': ['BHP.AX'],
  '^IRX': ['UST-3M', 'SGOV'], '^FVX': ['UST-5Y', 'IEF'], '^TNX': ['UST-10Y', 'IEF', 'TLT'], '^TYX': ['UST-30Y', 'TLT', '00679B.TWO'],
  'GC=F': ['XAU', 'GLD', '00635U.TW'], 'SI=F': ['XAG', 'SLV'], 'CL=F': ['USO', '00642U.TW'], 'BZ=F': ['USO'], 'NG=F': [], 'HG=F': ['CPER'],
  'ZC=F': ['DBA'], 'ZW=F': ['DBA'], 'KC=F': ['DBA']
};

// Words that mean one thing however a name writes it: a fund's English name
// cut short ("Cathay ESG High Div", "High Div Yield"), a Taiwan ETF's
// Chinese one (高息, 優息 for 高股息): "dividend" or 高股息 finds them all
// (00878, 00919, 00929, 00940, 00713 and VYM were missed, 2026-10). Latin
// ones whole words only (div isn't divine).
const SAME = [
  ['dividend', 'dividends', 'div', 'dvd', '股息', '股利', '高息', '優息', '配息', '填息'],
  ['高股息', '高息', '優息', 'high dividend', 'high div'],
  ['income', '收益', '月配', 'premium income'],
  ['yield', '殖利率', '收益率']
];
// What a thing is, searched too ("dividend etf", 台股 台積): its list's words.
const KIND_WORDS = { tw: '台股 stock', twetf: 'etf 台灣etf', us: '美股 stock', usetf: 'etf 美國etf', govbond: '公債 bond', bond: 'etf 債券 bond', crypto: '加密 crypto', fx: '外匯 forex', metal: '原物料 commodity', jp: '日股 stock', hk: '港股 陸股 stock', kr: '韓股 stock', eu: '歐股 stock', fund: '基金 fund', index: '指數 index', fut: '期貨 futures', ssf: '期貨 個股期 futures', etffut: '期貨 etf futures' };
const has = (hay, w) => (/^[a-z ]+$/.test(w) ? new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(hay) : hay.includes(w));
const matches = (hay, w) => hay.includes(w) || SAME.some(g => g.includes(w) && g.some(x => has(hay, x)));

// Chinese or English names, symbols: every word of the query must match
// (itself, or a word that means the same: SAME).
export function searchCatalog(query, limit = 30) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const info of INFO.values()) {
    const hay = `${info.symbol} ${info.symbol.replace(/\.[A-Z]+$|-USD$/, '')} ${info.zh} ${info.en} ${KIND_WORDS[info.category] || ''}`.toLowerCase();
    if (!words.every(w => matches(hay, w))) continue;
    const bare = info.symbol.toLowerCase().replace(/\.[a-z]+$|-usd$/, '');
    const q = words.join(' ');
    const score = bare === q || info.symbol.toLowerCase() === q ? 0 : info.zh.toLowerCase().startsWith(q) || info.en.toLowerCase().startsWith(q) ? 1 : 2;
    scored.push([score, info]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, info]) => info);
}
