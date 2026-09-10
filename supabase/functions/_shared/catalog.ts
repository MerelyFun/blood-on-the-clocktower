import type { Role, Script, Team } from './types.ts';
// 自行撰写的简要机制提示，不替代官方角色条目。无官方美术、风味文本或 PDF。
// 相对夜序按官方 nightsheet 的基础剧本子集排列；自制角色可手动设定。
export const FIRST_NIGHT = 'dusk angel buddhist toymaker stormcatcher wraith lordoftyphon kazali apprentice barista bureaucrat thief boffin philosopher alchemist poppygrower yaggababble magician tor minioninfo snitch lunatic summoner demoninfo king sailor marionette engineer preacher lilmonsta lleech xaan poisoner widow courtier wizard snakecharmer godfather organgrinder devilsadvocate eviltwin witch cerenovus fearmonger harpy mezepheles pukka pixie huntsman damsel amnesiac washerwoman librarian investigator chef empath fortuneteller butler grandmother clockmaker dreamer seamstress steward knight noble balloonist shugenja villageidiot bountyhunter nightwatchman cultleader spy ogre highpriestess general chambermaid mathematician dawn leviathan vizier'.split(' ');
export const OTHER_NIGHT = 'dusk duchess toymaker wraith cacklejack barista bureaucrat thief harlot bonecollector philosopher poppygrower sailor engineer preacher xaan poisoner courtier innkeeper wizard gambler acrobat snakecharmer monk organgrinder devilsadvocate witch cerenovus pithag fearmonger harpy mezepheles scarletwoman summoner lunatic exorcist lycanthrope princess legion imp zombuul pukka shabaloth po fanggu nodashii vortox lordoftyphon vigormortis ojo alhadikhia lleech lilmonsta yaggababble kazali assassin godfather gossip hatter barber sweetheart plaguedoctor sage banshee professor choirboy huntsman damsel amnesiac farmer tinker moonchild grandmother tor ravenkeeper empath fortuneteller undertaker dreamer flowergirl towncrier oracle seamstress juggler balloonist villageidiot king bountyhunter nightwatchman cultleader butler spy highpriestess general chambermaid mathematician riot dawn leviathan'.split(' ');
const first=FIRST_NIGHT,other=OTHER_NIGHT;
type Row = [string,string,Team,string,string?];
const rows: Record<string, Row[]> = {
 fabled: [
 ['sentinel','哨兵','fabled','允许初始配置多一名或少一名外来者；由说书人手动修正角色配比。'],
 ['spiritofivory','圣洁之魂','fabled','限制对局中新增邪恶玩家的数量；阵营变化前需检查该规则。'],
 ['djinn','灯神','fabled','要求遵守本剧本涉及的角色相克规则。'],
 ['hellslibrarian','地狱图书管理员','fabled','说书人要求安静时维持秩序；违反者可能受到游戏内后果。'],
 ['angel','天使','fabled','为新玩家设置保护性桌规；根据角色条目处理新玩家死亡的责任。'],
 ['toymaker','玩具匠','fabled','允许邪恶玩家获得常规开局信息；恶魔需要至少有一夜选择不攻击。'],
 ['fibbin','骗人精','fabled','说书人可在整局中给一名善良玩家一次错误信息。'],
 ['fiddler','提琴手','fabled','提供提前结束游戏的特殊对决与投票流程，按官方条目手动进行。']
 ],
 loric: [
 ['bootlegger','私货商人','loric','使用经过说明的自制角色或房规；把本局变更写入公开剧本与公告。'],
 ['gardener','园丁','loric','允许说书人安排玩家的起始角色，使用保持座位的手动发牌方式。']
 ],
 tb: [
 ['washerwoman','洗衣妇','townsfolk','开局获知两名玩家，其中一人是指定镇民。','镇民,错误'],
 ['librarian','图书管理员','townsfolk','开局获知两人中有一名指定外来者；也可能得知没有外来者。','外来者,错误'],
 ['investigator','调查员','townsfolk','开局获知两名玩家，其中一人是指定爪牙。','爪牙,错误'],
 ['chef','厨师','townsfolk','开局获知相邻邪恶玩家对数。'],
 ['empath','共情者','townsfolk','每夜获知两侧最近存活邻居中的邪恶人数。'],
 ['fortuneteller','占卜师','townsfolk','每夜选择两人，获知其中是否有恶魔；一名善良玩家会被误判。','干扰项'],
 ['undertaker','送葬者','townsfolk','除首夜外，获知当天被处决且死亡者的角色。','被处决'],
 ['monk','僧侣','townsfolk','除首夜外，每夜保护另一名玩家免受恶魔影响。','保护'],
 ['ravenkeeper','守鸦人','townsfolk','夜里死亡时，选择一人并获知其角色。','夜间死亡'],
 ['virgin','贞洁者','townsfolk','首次被提名时，若提名者是镇民，立即处决提名者。','能力已用'],
 ['slayer','猎手','townsfolk','整局一次，白天公开选择一人；若为恶魔则使其死亡。','能力已用'],
 ['soldier','士兵','townsfolk','恶魔的能力无法影响你。'],
 ['mayor','市长','townsfolk','三人存活的白天无人被处决，可使善良获胜；夜间死亡可能转移。'],
 ['butler','管家','outsider','每夜选择另一人为主人；只有主人投票时才能投票。','主人'],
 ['drunk','酒鬼','outsider','实际没有所展示镇民的能力；本人会认为自己是那个镇民。','展示身份'],
 ['recluse','隐士','outsider','可能被当作邪恶、爪牙或恶魔，包括死后。'],
 ['saint','圣徒','outsider','因处决而死亡会令己方失败。'],
 ['poisoner','投毒者','minion','每夜选择一人，使其中毒至下个黄昏。','中毒'],
 ['spy','间谍','minion','每夜可以查看魔典；可能被当作善良、镇民或外来者，包括死后。'],
 ['scarletwoman','红唇女郎','minion','满足存活人数条件时，恶魔死亡后可继承恶魔身份。','继承恶魔'],
 ['baron','男爵','minion','初始配置中增加两名外来者，等量减少镇民。'],
 ['imp','小恶魔','demon','除首夜外，每夜杀一人；自杀时可由一名爪牙接替。','死亡']
 ],
 bmr: [
 ['grandmother','祖母','townsfolk','开局知道一名善良玩家及角色；该玩家被恶魔杀死时，自己也会死亡。','孙子,死亡'],
 ['sailor','水手','townsfolk','每夜选一名活人，由说书人使你们之一醉酒到黄昏；能力有效时你不会死亡。','醉酒'],
 ['chambermaid','侍女','townsfolk','每夜选择另外两名活人，得知其中今晚因自身能力醒来的人数。'],
 ['exorcist','驱魔人','townsfolk','除首夜外选一人，不可连续选同人；选中恶魔会令其得知你且当夜不醒。','驱魔'],
 ['innkeeper','旅店老板','townsfolk','除首夜外选两人，使其当夜不会死亡，其中一人醉酒到黄昏。','保护,醉酒'],
 ['gambler','赌徒','townsfolk','除首夜外猜一人的角色，猜错则死亡。','死亡'],
 ['gossip','造谣者','townsfolk','白天公开陈述，若该陈述为真，夜里会有一人死亡。','死亡'],
 ['courtier','侍臣','townsfolk','整局一次，夜间选一个角色，使其醉酒三天三夜。','第一天,第二天,第三天,已用'],
 ['professor','教授','townsfolk','整局一次，除首夜外选一名死者，若为镇民则复活。','复活,已用'],
 ['minstrel','吟游诗人','townsfolk','爪牙被处决致死后，除你外的玩家醉酒到次日黄昏。','醉酒'],
 ['tealady','茶艺师','townsfolk','若两侧最近的存活邻居都善良，他们不会死亡。','保护'],
 ['pacifist','和平主义者','townsfolk','被处决的善良玩家可能免于死亡。'],
 ['fool','弄臣','townsfolk','第一次本应死亡时免于死亡。','已用'],
 ['goon','莽夫','outsider','每夜首个用能力选择你的玩家醉酒到黄昏；你转为其阵营。','醉酒'],
 ['lunatic','疯子','outsider','认为自己是恶魔；真正恶魔获知你和你每夜的选择。','展示身份'],
 ['tinker','修补匠','outsider','说书人可以在任意时刻使你死亡。','死亡'],
 ['moonchild','月之子','outsider','首次得知自己死亡时，公开选一名活人；若善良，今晚会死亡。','死亡'],
 ['godfather','教父','minion','开局知道在场外来者；白天外来者死亡后，夜间可杀一人。配置增减一名外来者。','死亡'],
 ['devilsadvocate','魔鬼代言人','minion','每夜保护一名活人免于次日处决死亡，不可连续选择同人。','处决保护'],
 ['assassin','刺客','minion','整局一次，除首夜外选择一人，使其死亡，即使本来不会死亡。','已用,死亡'],
 ['mastermind','主谋','minion','恶魔被处决致死后继续一天；翌日若有处决，被处决者阵营落败。','额外一天'],
 ['zombuul','僵怖','demon','除首夜外，白天无人死亡则夜间杀一人；首次死亡会被当作已死，实际仍存活。','死亡,外观死亡'],
 ['pukka','普卡','demon','每夜选一人中毒；此前被你毒的人死亡，然后解除其毒。','中毒,死亡'],
 ['shabaloth','沙巴洛斯','demon','除首夜外，每夜可杀两人；上一夜选过的死者可能被反刍复活。','死亡,反刍'],
 ['po','珀','demon','除首夜外可杀一人；若选择蓄力不杀，下次可选三人。','蓄力,死亡']
 ],
 snv: [
 ['clockmaker','钟表匠','townsfolk','开局得知恶魔与最近爪牙之间的座位距离。'],
 ['dreamer','筑梦师','townsfolk','每夜选择另一人，获知一善一恶两个候选角色，其中一个正确。'],
 ['snakecharmer','舞蛇人','townsfolk','每夜选活人；若选中恶魔，互换角色及阵营，原恶魔中毒。','中毒'],
 ['mathematician','数学家','townsfolk','每夜获知自上个黎明起因其他角色能力而异常工作的玩家数量。','异常'],
 ['flowergirl','卖花女孩','townsfolk','除首夜外，获知当天恶魔是否投过票。'],
 ['towncrier','城镇公告员','townsfolk','除首夜外，获知当天是否有爪牙发起提名。'],
 ['oracle','神谕者','townsfolk','除首夜外，得知当前死者中的邪恶人数。'],
 ['savant','博学者','townsfolk','每天可私下向说书人获取两条信息，一真一假。'],
 ['seamstress','女裁缝','townsfolk','整局一次，夜间选择另外两人，获知两人阵营是否相同。','已用'],
 ['philosopher','哲学家','townsfolk','整局一次，夜间选择一个善良角色并获得其能力；在场原角色会醉酒。','获得能力,醉酒'],
 ['artist','艺术家','townsfolk','整局一次，白天私下询问说书人一个是非问题。','已用'],
 ['juggler','杂耍艺人','townsfolk','首个白天公开猜至多五人的角色；当夜获知正确的数量。','正确'],
 ['sage','贤者','townsfolk','被恶魔杀死时，获知两名玩家，其中一人为恶魔。'],
 ['mutant','畸形秀演员','outsider','若表现得像在声称自己是外来者，可能立即被处决。'],
 ['sweetheart','心上人','outsider','死亡后，一名玩家开始醉酒。','醉酒'],
 ['barber','理发师','outsider','死亡后，恶魔可以选择两名非恶魔玩家互换角色。','交换'],
 ['klutz','呆瓜','outsider','得知自己死亡时公开选活人；若选到邪恶，己方落败。'],
 ['eviltwin','镜像双子','minion','与一名对立阵营玩家互相知晓身份；善良双子被处决会令邪恶获胜，双子都活着时善良不能获胜。','善良双子'],
 ['witch','女巫','minion','每夜选一人，若其次日提名则死亡；仅剩三名活人时失效。','诅咒'],
 ['cerenovus','洗脑师','minion','每夜选一人与一个善良角色，要求其明天相信自己是该角色，否则可能被处决。','疯狂'],
 ['pithag','麻脸巫婆','minion','除首夜外，选一人和一个不在场角色使其变身；创造恶魔时当夜死亡由说书人决定。','新角色'],
 ['fanggu','方古','demon','除首夜外每夜杀一人；首次杀外来者时可能让其变为邪恶方古并代替你。配置增加一名外来者。','转移已用,死亡'],
 ['vigormortis','亡骨魔','demon','除首夜外每夜杀一人；被杀爪牙保留能力，并使附近镇民中毒。配置减少一名外来者。','保留能力,中毒,死亡'],
 ['nodashii','诺-达鲺','demon','除首夜外每夜杀一人；你两侧最近的镇民中毒。','中毒,死亡'],
 ['vortox','涡流','demon','除首夜外每夜杀一人；镇民信息须为假；任何一天无人被处决会令邪恶获胜。','死亡']
 ],
 traveller: [
 ['scapegoat','替罪羊','traveller','被处决者的死亡可能转移给你。'],
 ['gunslinger','枪手','traveller','每天一次，在投票结束后可射杀刚刚投票的一人。'],
 ['beggar','乞丐','traveller','需要获赠死者票才能投票；赠票与阵营获知按角色条目处理。'],
 ['bureaucrat','官员','traveller','每夜选另一人，使其次日投票权重增加。','三票'],
 ['thief','窃贼','traveller','每夜选另一人，使其次日投票计为负票。','负票'],
 ['butcher','屠夫','traveller','当天首次处决后，可提名产生额外一次处决。'],
 ['bonecollector','集骨者','traveller','整局一次，夜里让一名死者暂时恢复能力。','已用,恢复能力'],
 ['harlot','流莺','traveller','除首夜外选择活人并征求同意；其同意后可得知角色，但可能导致死亡。'],
 ['barista','咖啡师','traveller','说书人每夜选人，令其获得清醒健康与正确信息或多次行动的效果。','清醒健康,两次行动'],
 ['deviant','怪咖','traveller','当天逗笑说书人后，可免于该日放逐。'],
 ['apprentice','学徒','traveller','获得一个能力；善良时来自镇民，邪恶时来自爪牙。','获得能力'],
 ['matron','女舍监','traveller','可安排座位与离座；其他人交换座位需要经过你。'],
 ['voudon','巫毒师','traveller','仅你和死者可投票，死者投票不消耗票权，门槛按能力调整。'],
 ['judge','法官','traveller','整局一次，强制一个提名成功或失败。','已用'],
 ['bishop','主教','traveller','提名由说书人安排，每天至少选择一名对立阵营玩家。']
 ]
};
export const CATALOG: Role[] = Object.entries(rows).flatMap(([edition,rs]) => rs.map(([id,name,team,ability,reminders]) => ({
 id,name,team,edition,ability,firstNight:first.indexOf(id)<0?0:first.indexOf(id)+1,
 otherNight:other.indexOf(id)<0?0:other.indexOf(id)+1,
 reminders: reminders?.split(',') ?? [], setup:['baron','godfather','fanggu','vigormortis'].includes(id)
})));
export const ROLE_MAP = Object.fromEntries(CATALOG.map(r=>[r.id,r]));
const editions = [['tb','暗流涌动','Trouble Brewing','从信息与逻辑出发。适合初次主持，也经得起反复游玩。'],['bmr','黯月初升','Bad Moon Rising','死亡、保护与复活交织。每一次死亡都值得追问。'],['snv','梦殒春宵','Sects & Violets','变化、信息与疯狂。给善于推理的城镇多一点挑战。']];
export const BASE_SCRIPTS: Script[] = editions.map(([id,name,english,description])=>({
 id, name, author:'The Pandemonium Institute',description, version:1, roles:CATALOG.filter(r=>r.edition===id),
 meta:{id:'_meta',name,author:'The Pandemonium Institute',english},extras:[],updatedAt:'2026-09-09T00:00:00Z'
}));
export function defaultAlignment(team: Team) { return team==='minion'||team==='demon'?'evil' as const:'good' as const; }
export function findRole(script: Script, id: string) { return script.roles.find(r=>r.id===id) ?? ROLE_MAP[id]; }
export function baseCounts(n: number): number[] {
 const counts: Record<number,number[]>={5:[3,0,1,1],6:[3,1,1,1],7:[5,0,1,1],8:[5,1,1,1],9:[5,2,1,1],10:[7,0,2,1],11:[7,1,2,1],12:[7,2,2,1],13:[9,0,3,1],14:[9,1,3,1],15:[9,2,3,1]};
 return counts[n]??counts[7];
}
