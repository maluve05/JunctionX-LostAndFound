/*
  Country calling codes for the phone field: "Country|code", Portugal first,
  then alphabetical. Countries that share a code (Canada and the US, say) each
  keep their own row, so people find their own name.
*/
const RAW = `Portugal|351
Afghanistan|93
Albania|355
Algeria|213
Andorra|376
Angola|244
Argentina|54
Armenia|374
Australia|61
Austria|43
Azerbaijan|994
Bahrain|973
Bangladesh|880
Belarus|375
Belgium|32
Benin|229
Bolivia|591
Bosnia and Herzegovina|387
Brazil|55
Bulgaria|359
Cambodia|855
Cameroon|237
Canada|1
Cape Verde|238
Chile|56
China|86
Colombia|57
Costa Rica|506
Croatia|385
Cuba|53
Cyprus|357
Czechia|420
Denmark|45
Dominican Republic|1
Ecuador|593
Egypt|20
Estonia|372
Ethiopia|251
Finland|358
France|33
Georgia|995
Germany|49
Ghana|233
Greece|30
Guatemala|502
Guinea-Bissau|245
Hong Kong|852
Hungary|36
Iceland|354
India|91
Indonesia|62
Iran|98
Iraq|964
Ireland|353
Israel|972
Italy|39
Ivory Coast|225
Japan|81
Jordan|962
Kazakhstan|7
Kenya|254
Kosovo|383
Kuwait|965
Latvia|371
Lebanon|961
Liechtenstein|423
Lithuania|370
Luxembourg|352
Macau|853
Malaysia|60
Malta|356
Mexico|52
Moldova|373
Monaco|377
Montenegro|382
Morocco|212
Mozambique|258
Nepal|977
Netherlands|31
New Zealand|64
Nigeria|234
North Macedonia|389
Norway|47
Oman|968
Pakistan|92
Panama|507
Paraguay|595
Peru|51
Philippines|63
Poland|48
Qatar|974
Romania|40
Russia|7
Rwanda|250
São Tomé and Príncipe|239
Saudi Arabia|966
Senegal|221
Serbia|381
Singapore|65
Slovakia|421
Slovenia|386
South Africa|27
South Korea|82
Spain|34
Sri Lanka|94
Sweden|46
Switzerland|41
Taiwan|886
Tanzania|255
Thailand|66
Timor-Leste|670
Tunisia|216
Turkey|90
Uganda|256
Ukraine|380
United Arab Emirates|971
United Kingdom|44
United States|1
Uruguay|598
Uzbekistan|998
Venezuela|58
Vietnam|84
Zambia|260
Zimbabwe|263`;

export type Country = { name: string; code: string };

export const COUNTRIES: Country[] = RAW.split("\n").map((line) => {
  const [name, code] = line.split("|");
  return { name, code: `+${code}` };
});
