export interface Nationality {
  code: string;
  name: string;
  flag: string;
  /** Relative likelihood of an AI driver coming from here. */
  weight: number;
  firstNames: string[];
  lastNames: string[];
}

export const NATIONALITIES: Nationality[] = [
  {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', weight: 12,
    firstNames: ['Oliver', 'Harry', 'Callum', 'Jude', 'Freddie', 'Toby', 'Reuben', 'Alfie'],
    lastNames: ['Whitlock', 'Ashcroft', 'Hearn', 'Brentwood', 'Calloway', 'Rowntree', 'Vane', 'Sedgley']
  },
  {
    code: 'IT', name: 'Italy', flag: '🇮🇹', weight: 8,
    firstNames: ['Luca', 'Matteo', 'Alessio', 'Giacomo', 'Nicolo', 'Stefano', 'Enzo', 'Dario'],
    lastNames: ['Moretti', 'Barsanti', 'Colombo', 'Ferretti', 'Ricciardi', 'Sartori', 'Venturi', 'Alberti']
  },
  {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱', weight: 5,
    firstNames: ['Sem', 'Daan', 'Bram', 'Joep', 'Ruben', 'Timo', 'Stijn', 'Lars'],
    lastNames: ['van Doorn', 'Kuipers', 'de Bruin', 'Meijer', 'Vos', 'Hoekstra', 'Bakker', 'Rietveld']
  },
  {
    code: 'FR', name: 'France', flag: '🇫🇷', weight: 8,
    firstNames: ['Theo', 'Hugo', 'Nathan', 'Corentin', 'Baptiste', 'Rayan', 'Cyprien', 'Armand'],
    lastNames: ['Duclos', 'Marchand', 'Lefevre', 'Bonnet', 'Delacroix', 'Aubert', 'Rivard', 'Perrot']
  },
  {
    code: 'DE', name: 'Germany', flag: '🇩🇪', weight: 7,
    firstNames: ['Jonas', 'Lennard', 'Fabian', 'Moritz', 'Nico', 'Emil', 'Julian', 'Tobias'],
    lastNames: ['Brandt', 'Hoffmann', 'Reuter', 'Kessler', 'Wagner', 'Lindner', 'Steinbach', 'Vogel']
  },
  {
    code: 'ES', name: 'Spain', flag: '🇪🇸', weight: 6,
    firstNames: ['Alvaro', 'Pablo', 'Iker', 'Marc', 'Diego', 'Adrian', 'Bruno', 'Gonzalo'],
    lastNames: ['Serrano', 'Ibanez', 'Vidal', 'Castells', 'Puig', 'Arribas', 'Solana', 'Quintero']
  },
  {
    code: 'BR', name: 'Brazil', flag: '🇧🇷', weight: 6,
    firstNames: ['Rafael', 'Caio', 'Gustavo', 'Enzo', 'Vinicius', 'Murilo', 'Thiago', 'Otavio'],
    lastNames: ['Barbosa', 'Nogueira', 'Almeida', 'Rezende', 'Fontoura', 'Machado', 'Duarte', 'Salles']
  },
  {
    code: 'AU', name: 'Australia', flag: '🇦🇺', weight: 5,
    firstNames: ['Cooper', 'Jack', 'Riley', 'Lachlan', 'Hudson', 'Angus', 'Beau', 'Mason'],
    lastNames: ['Halloran', 'Renshaw', 'Kirby', 'Mackenzie', 'Doyle', 'Fitzroy', 'Larkin', 'Pemberton']
  },
  {
    code: 'US', name: 'United States', flag: '🇺🇸', weight: 6,
    firstNames: ['Chase', 'Blake', 'Colton', 'Wyatt', 'Hunter', 'Grayson', 'Tanner', 'Brooks'],
    lastNames: ['Sutter', 'Hollis', 'Mercer', 'Vance', 'Rowan', 'Kessinger', 'Braddock', 'Ellery']
  },
  {
    code: 'JP', name: 'Japan', flag: '🇯🇵', weight: 4,
    firstNames: ['Ren', 'Sota', 'Haruto', 'Kaito', 'Yuma', 'Riku', 'Asahi', 'Takumi'],
    lastNames: ['Kurosawa', 'Nakahara', 'Fujimoto', 'Sakurai', 'Onishi', 'Tachibana', 'Miyamoto', 'Hasegawa']
  },
  {
    code: 'MX', name: 'Mexico', flag: '🇲🇽', weight: 3,
    firstNames: ['Emiliano', 'Santiago', 'Leonardo', 'Rodrigo', 'Maximo', 'Ivan', 'Alonso', 'Cesar'],
    lastNames: ['Bustamante', 'Carranza', 'Rosales', 'Herrera', 'Zamudio', 'Villalobos', 'Escamilla', 'Nieto']
  },
  {
    code: 'AR', name: 'Argentina', flag: '🇦🇷', weight: 3,
    firstNames: ['Bautista', 'Joaquin', 'Valentin', 'Lautaro', 'Tomas', 'Franco', 'Benicio', 'Nahuel'],
    lastNames: ['Ferreyra', 'Bianchi', 'Ocampo', 'Sandoval', 'Zabala', 'Otamendi', 'Cabral', 'Pizarro']
  },
  {
    code: 'FI', name: 'Finland', flag: '🇫🇮', weight: 3,
    firstNames: ['Eetu', 'Aatos', 'Veeti', 'Onni', 'Elias', 'Niilo', 'Otso', 'Joona'],
    lastNames: ['Virtanen', 'Lehtonen', 'Rantala', 'Kallio', 'Hakkarainen', 'Nieminen', 'Saarinen', 'Koskela']
  },
  {
    code: 'DK', name: 'Denmark', flag: '🇩🇰', weight: 2,
    firstNames: ['Mikkel', 'Oscar', 'Emil', 'Villads', 'Anton', 'Malthe', 'Storm', 'Aksel'],
    lastNames: ['Bering', 'Holmgaard', 'Kjaer', 'Lundqvist', 'Norgaard', 'Dalgaard', 'Riis', 'Bech']
  },
  {
    code: 'CA', name: 'Canada', flag: '🇨🇦', weight: 3,
    firstNames: ['Liam', 'Owen', 'Xavier', 'Nolan', 'Emmett', 'Rylan', 'Beckett', 'Desmond'],
    lastNames: ['Beaulieu', 'Thibault', 'Winters', 'Gauthier', 'Lachance', 'Kilburn', 'Ferland', 'Osgood']
  },
  {
    code: 'IL', name: 'Israel', flag: '🇮🇱', weight: 1,
    firstNames: ['Yaniv', 'Itai', 'Omer', 'Roi', 'Adam', 'Guy', 'Noam', 'Eitan'],
    lastNames: ['Axen', 'Barzel', 'Shalev', 'Gilad', 'Peretz', 'Aviram', 'Doron', 'Halevi']
  },
  {
    code: 'BE', name: 'Belgium', flag: '🇧🇪', weight: 2,
    firstNames: ['Arthur', 'Wout', 'Lucas', 'Senne', 'Vic', 'Mathis', 'Jules', 'Ferre'],
    lastNames: ['Vandael', 'Peeters', 'Claessens', 'Dewulf', 'Maes', 'Verhoeven', 'Segers', 'Coppens']
  },
  {
    code: 'CH', name: 'Switzerland', flag: '🇨🇭', weight: 2,
    firstNames: ['Noe', 'Levin', 'Andrin', 'Yannick', 'Silvan', 'Loris', 'Timo', 'Elia'],
    lastNames: ['Brunner', 'Zuercher', 'Gasser', 'Rothen', 'Amrein', 'Baumgartner', 'Kuenzli', 'Steiner']
  },
  {
    code: 'SE', name: 'Sweden', flag: '🇸🇪', weight: 2,
    firstNames: ['Elton', 'Vidar', 'Melvin', 'Sixten', 'Alvar', 'Loke', 'Hugo', 'Folke'],
    lastNames: ['Lindqvist', 'Bergstrom', 'Sandell', 'Hedlund', 'Ostberg', 'Wallin', 'Falk', 'Norling']
  },
  {
    code: 'PL', name: 'Poland', flag: '🇵🇱', weight: 2,
    firstNames: ['Kacper', 'Antoni', 'Filip', 'Wiktor', 'Igor', 'Nikodem', 'Borys', 'Oskar'],
    lastNames: ['Zielinski', 'Kaminski', 'Wojcik', 'Sikora', 'Baran', 'Zawadzki', 'Malinowski', 'Adamczyk']
  },
  {
    code: 'CN', name: 'China', flag: '🇨🇳', weight: 3,
    firstNames: ['Zhihao', 'Yiming', 'Junjie', 'Haoran', 'Chenxi', 'Zeyu', 'Kaiwen', 'Ruoxi'],
    lastNames: ['Zhou', 'Liang', 'Xu', 'Cheng', 'Tan', 'Qiu', 'Shen', 'Lu']
  },
  {
    code: 'IN', name: 'India', flag: '🇮🇳', weight: 2,
    firstNames: ['Arjun', 'Vihaan', 'Kabir', 'Reyansh', 'Aarav', 'Dhruv', 'Ishaan', 'Rohan'],
    lastNames: ['Chandran', 'Bhatia', 'Raghavan', 'Sethi', 'Malhotra', 'Iyer', 'Nadkarni', 'Verma']
  },
  {
    code: 'ZA', name: 'South Africa', flag: '🇿🇦', weight: 2,
    firstNames: ['Ruan', 'Divan', 'Jaco', 'Sipho', 'Tiaan', 'Kagiso', 'Werner', 'Lehan'],
    lastNames: ['Venter', 'Naidoo', 'Botha', 'Mokoena', 'Steenkamp', 'Dlamini', 'Coetzee', 'Fourie']
  },
  {
    code: 'NZ', name: 'New Zealand', flag: '🇳🇿', weight: 1,
    firstNames: ['Fletcher', 'Marlow', 'Bailey', 'Cohen', 'Tane', 'Quinn', 'Rhys', 'Archer'],
    lastNames: ['Hargreaves', 'Ngata', 'Cathcart', 'Waverley', 'Beattie', 'Trelawney', 'McAra', 'Sinclair']
  },
  {
    code: 'PT', name: 'Portugal', flag: '🇵🇹', weight: 2,
    firstNames: ['Tomas', 'Duarte', 'Afonso', 'Salvador', 'Vicente', 'Rodrigo', 'Gaspar', 'Martim'],
    lastNames: ['Figueiredo', 'Meireles', 'Alvim', 'Tavares', 'Bettencourt', 'Cordeiro', 'Sampaio', 'Vasques']
  },
  {
    code: 'AT', name: 'Austria', flag: '🇦🇹', weight: 2,
    firstNames: ['Jakob', 'Elias', 'Valentin', 'Konstantin', 'Simon', 'Raphael', 'Fabio', 'Leon'],
    lastNames: ['Hofer', 'Gruber', 'Pichler', 'Ebner', 'Auer', 'Wolkenstein', 'Reiter', 'Moser']
  },
  {
    code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', weight: 1,
    firstNames: ['Rashid', 'Khalid', 'Omar', 'Saif', 'Hamdan', 'Yousef', 'Faris', 'Zayed'],
    lastNames: ['Al Mazrouei', 'Al Qassimi', 'Al Hashemi', 'Al Marri', 'Al Suwaidi', 'Al Ketbi', 'Al Rumaithi', 'Al Nuaimi']
  },
  {
    code: 'SG', name: 'Singapore', flag: '🇸🇬', weight: 1,
    firstNames: ['Ethan', 'Marcus', 'Zher', 'Ryan', 'Wei', 'Julian', 'Darius', 'Aaron'],
    lastNames: ['Tan', 'Lim', 'Ong', 'Chandra', 'Goh', 'Yeo', 'Rajan', 'Seah']
  },
  {
    code: 'KR', name: 'South Korea', flag: '🇰🇷', weight: 1,
    firstNames: ['Minjun', 'Seojun', 'Doyun', 'Jiho', 'Hyunwoo', 'Siwoo', 'Eunwoo', 'Junseo'],
    lastNames: ['Kang', 'Baek', 'Seo', 'Yoon', 'Moon', 'Ha', 'Jeong', 'Ahn']
  },
  {
    code: 'CO', name: 'Colombia', flag: '🇨🇴', weight: 1,
    firstNames: ['Samuel', 'Juan', 'Nicolas', 'Andres', 'Esteban', 'Simon', 'Julian', 'Miguel'],
    lastNames: ['Montoya', 'Escobar', 'Restrepo', 'Cardenas', 'Osorio', 'Gutierrez', 'Arango', 'Bermudez']
  },
  {
    code: 'IE', name: 'Ireland', flag: '🇮🇪', weight: 1,
    firstNames: ['Cian', 'Fionn', 'Ronan', 'Oisin', 'Darragh', 'Conor', 'Eoin', 'Tadhg'],
    lastNames: ['Kavanagh', 'Donnelly', 'Fitzgerald', 'Moloney', 'Brannigan', 'Hegarty', 'Doheny', 'Colgan']
  },
  {
    code: 'TH', name: 'Thailand', flag: '🇹🇭', weight: 1,
    firstNames: ['Nathee', 'Krit', 'Anon', 'Pasin', 'Chai', 'Thanawat', 'Rapee', 'Sarawut'],
    lastNames: ['Sirichai', 'Wongsawat', 'Ratanapong', 'Chaiyaphum', 'Panyarachun', 'Intharat', 'Boonmee', 'Suphan']
  }
];

export const NATIONALITY_BY_CODE: Record<string, Nationality> = Object.fromEntries(
  NATIONALITIES.map((n) => [n.code, n])
);
