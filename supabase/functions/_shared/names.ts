// Famous real golfers' names are kept out on purpose (no first name + surname pair here makes one).
// A bigger name bank for the shared world's computer golfers and coaches, so no two share a name.
// First names, then surnames, per country, kept true to each country. The solo game keeps its own short lists (js/core.js).
const RAW: Record<string, [string, string]> = {
  US: ['Cole Tucker Brady Wyatt Mason Reid Grant Hank Beau Chase Dalton Trey Garrett Logan Austin Tyler Cody Blake Hunter Colby Brock Landon Parker Cameron Travis Spencer Clay Dustin Kyle Ryan Bryce Jake Wade Bennett Graham Sawyer Shane Brett Dylan Caleb',
'Hale Mercer Dawkins Pruitt Calloway Sutter Boone Whitfield Tanner Briggs Thibodeaux Kessler Harmon Prescott Coleman Bradford Holcomb Langley Whitaker Pierce Sheffield Kendrick Barlow Hollister Weston Carver Lockhart Gentry Stratton Maddox Ellison Crawford Fulton Ashby Keller Pennington Rutledge Holt Spalding Garrison Mayfield Rhodes Sterling Ramsey Wheeler Barrett Dunlap Cobb Stanton Hayward Merritt Thornton Vance Hargrove Albright Sinclair Talbot Easton Kimball'],
  CA: ['Liam Gus Owen Nolan Brett Carter Mathieu Etienne Connor Tristan Graham Jesse Logan Dawson Gavin Rhys Elliot Kieran Jacob Benoit Gabriel Felix Hayden Quinn Corey Darcy Simon Colin Dominic Malcolm',
       'Halloran Tremblay MacKay Fortin Dumont Leduc Gagnon Bouchard Pelletier Lavoie Gauthier Morin Ouellet Cormier Belanger Lachance Fraser MacDonald McLeod Campbell Brennan Sutherland Boucher Paquette Desjardins Charbonneau Arsenault Kowalchuk Petrenko Nadeau Theriault Robichaud Labelle Beaulieu MacIsaac Gillis Chiasson Laroche Wiebe Friesen'],
  MX: ['Diego Emilio Raul Javier Hector Ramon Alejandro Rodrigo Sebastian Eduardo Fernando Ricardo Arturo Gerardo Luis Joaquin Ignacio Mauricio Santiago Andres Esteban Cesar Armando Octavio Alfonso Rafael Gustavo Emiliano Patricio Adrian',
       'Fonseca Ibarra Salazar Cordero Montoya Beltran Hernandez Villarreal Cardenas Zamora Navarro Arellano Sandoval Quiroz Robles Valdez Garza Dominguez Treviño Mendoza Aguilar Ochoa Lozano Bustamante Cervantes Elizondo Galindo Herrera Tovar Escobedo Barajas Saldaña Gallardo Esparza Olvera Medrano Rangel Velazquez Arriaga Solis'],
  ENG: ['Oliver Monty Alfie George Harry Miles Jack Charlie Toby Freddie Archie Hugo Rupert Ollie Joe Sam Tom Will Ed Ben Danny Lewis Josh Callum Jamie Nathan Ryan Luke Henry Kit',
        'Pemberton Graves Ashdown Whitlock Fenwick Holloway Cartwright Ellingham Thornbury Fairweather Hargreaves Merriweather Blackwood Westbrook Ashworth Crowther Pickering Ainsworth Atherton Bramley Coulson Dennison Faulkner Gresham Hepworth Kingsley Lambert Marsden Nettleton Oakley Prentice Radcliffe Sherwood Tennant Underwood Waverley Yardley Barraclough Hawthorne Stamford'],
  SCO: ['Callum Wes Ewan Fraser Angus Blair Hamish Ross Euan Craig Lachlan Calum Murray Alasdair Iain Gregor Duncan Ruaridh Kyle Finlay Rory Struan Lewis Grant Douglas Neil Stuart Alastair Robbie Archie',
'Abernathy Drummond Kinloch Sinclair Buchanan Lennox MacLeod MacGregor Henderson Robertson Cameron Munro Mackenzie Grant Fraser Murray Stewart Gillespie Lindsay Galbraith Rutherford Crichton Dunbar Lamont MacKinnon Urquhart Strachan Kerr Baird Haldane Ogilvie Moncrieff Kirkwood Ballantyne Rennie Tait Cunningham Laidlaw'],
  IE: ['Declan Finn Cormac Padraig Shane Niall Eoin Ciaran Fionn Oisin Ronan Darragh Cathal Diarmuid Tadhg Colm Seamus Fergal Kieran Brendan Conor Lorcan Rory Senan Cian Donal Aidan Ruairi Eamon Liam',
       'Rourke Gallagher Brennan Tierney Mulcahy Devlin Brady Kavanagh Fitzgerald Donnelly McCarthy Doherty Flanagan Gallagher Hennessy Keane Lynch Maguire Nolan Quinlan Reilly Sheehan Whelan Byrne Costello Duggan Fahy Geraghty Hogan Kinsella Lennon Moynihan Nagle Phelan Regan Scanlon Toomey Brosnan Clancy Dillon'],
  FR: ['Fabien Luc Mathieu Remy Julien Bastien Antoine Clement Etienne Hugo Louis Nicolas Pierre Romain Thibault Victor Xavier Adrien Baptiste Cedric Damien Florian Gaspard Jules Laurent Maxime Olivier Quentin Sylvain Theo',
       'Leclair Moreau Garnier Delmas Rousseau Chabert Fontaine Mercier Girard Bonnet Lambert Faure Lefevre Dubois Laurent Simon Michel Roux Vincent Morel Fournier Blanchard Gauthier Perrin Marchand Duval Carpentier Lemaire Barbier Brunet Renaud Masson Picard Lacroix Aubert Guerin Boyer Chevalier Joubert Vidal'],
  ES: ['Pablo Alvaro Ignacio Sergio Marcos Adrian Alejandro Carlos Diego Enrique Fernando Gonzalo Hugo Iker Jaime Jorge Manuel Miguel Nacho Oscar Rafael Rodrigo Ruben Victor Xabier Jon Borja Inigo Unai Raul',
'Ibanez Medina Carrasco Zubiri Olmedo Requena Fernandez Lopez Martin Sanchez Romero Navarro Torres Dominguez Gil Vazquez Serrano Blanco Molina Morales Ortega Delgado Castro Rubio Marin Sanz Nunez Iglesias Arrieta Echeverria Goikoetxea Aranda Belmonte Cuesta Esteban Pastor Valero'],
  IT: ['Marco Luca Matteo Enzo Dario Alessandro Andrea Davide Federico Filippo Francesco Gabriele Giacomo Giorgio Lorenzo Mattia Nicola Paolo Pietro Riccardo Simone Stefano Tommaso Vittorio Edoardo Leonardo Michele Emanuele Fabio Renato',
       'Castellano Bellini Ferraro Rinaldi Vitale Marchetti Rossi Russo Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti DeLuca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Caruso Ferri Fabbri Galli Martinelli Leone Longo Gentile Martini Valentini Pellegrini'],
  DE: ['Hugo Lukas Jonas Felix Moritz Tobias Maximilian Paul Leon Niklas Julian Florian Sebastian Philipp Johannes Matthias Benedikt Konstantin Fabian Dominik Jannik Lennart Malte Henrik Till Bastian Kai Jan Simon Valentin',
       'Brandt Keller Vogel Reinhardt Lindner Hartmann Muller Schmidt Schneider Fischer Weber Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Schroder Neumann Schwarz Zimmermann Braun Kruger Hofmann Lange Werner Krause Lehmann Kohler Herrmann Konig Walter Mayer Huber Kaiser Fuchs Peters Seidel'],
  SE: ['Viktor Emil Axel Oskar Nils Anton Gustav Erik Johan Karl Linus Ludvig Melker Olle Pontus Rasmus Sixten Theo Vilgot Albin Alvar Hampus Isak Joel Kalle Leo Lukas Marcus Wilmer',
'Lindqvist Lindahl Sandberg Nystrom Ekstrom Hedlund Andersson Johansson Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Pettersson Jonsson Jansson Hansson Bengtsson Lindberg Lindgren Berglund Fredriksson Henriksson Holmberg Sundberg Wallin Engstrom Lundgren Bergstrom Ahlberg Forsberg Hellstrom Ostlund Sjoberg Blomqvist Dahlgren Wikstrom'],
  NO: ['Lars Magnus Henrik Sindre Eirik Tor Kristian Andreas Jonas Mathias Sander Haakon Even Fredrik Ole Petter Torstein Vegard Kasper Aksel Joakim Marius Espen Oyvind Stian Trond Geir Knut Sigurd Bjorn',
'Halvorsen Bakken Solberg Dahl Lunde Myhre Hansen Johansen Olsen Larsen Andersen Pedersen Nilsen Kristiansen Jensen Karlsen Haugen Eriksen Berg Hagen Strand Moen Lie Ruud Aasen Nygaard Lien Kvam Tangen Holm Sandvik Fjeld Rustad Brekke Haugland Solheim Vik Engen Stene'],
  DK: ['Mads Rasmus Soren Jeppe Mikkel Anders Frederik Magnus Christian Emil Kasper Jonas Mathias Nikolaj Oliver Simon Tobias Viktor Asger Bjarke Esben Kristoffer Lasse Malthe Niels Rune Troels Ulrik Casper Jakob',
       'Hvid Thorup Norgaard Lauritsen Skov Bruun Nielsen Jensen Hansen Pedersen Andersen Christensen Larsen Sorensen Rasmussen Jorgensen Petersen Madsen Kristensen Olsen Thomsen Christiansen Poulsen Johansen Mortensen Moller Knudsen Holm Mikkelsen Frederiksen Kjaer Dahl Vestergaard Damgaard Juhl Lund Bech Bang Krog Winther'],
  NL: ['Pieter Daan Sem Joost Ruben Bram Thijs Lars Jesse Stijn Milan Luuk Sven Niels Koen Tim Wouter Jasper Bas Gijs Hidde Floris Teun Jelle Maarten Sander Rick Tygo Mees Wessel',
       'Vos Dekker Brouwer Hendriks Postma Kuiper DeJong DeVries VanDijk Bakker Janssen Visser Smit Meijer DeBoer Mulder DeGroot Bos Peters Hendrikse VanLeeuwen Dijkstra Smits Willems VanDam Kok Jacobs Vermeulen VandenBerg Schouten Wouters Kramer Prins Huisman Peeters Koster Molenaar Hoekstra Verhoeven Blom'],
  ZA: ['Thabo Odell Ruan Dewald Sipho Jaco Pieter Johan Werner Francois Hendrik Morne Ernst Schalk Christiaan Thando Lwazi Kagiso Mandla Siyabonga Bongani Themba Lungile Dean Brandon Garth Shaun Darren',
'Nkosi Voss Botha Dlamini Venter Mokoena VanderMerwe Pretorius Steyn DuPlessis Coetzee Nel Fourie Swanepoel Kruger Joubert Viljoen Marais Ndlovu Khumalo Zulu Mthembu Sithole Ngcobo Mahlangu Mabaso Naidoo Pillay VanWyk Oosthuizen Erasmus Burger Grobler Louw Smit Malan Theron Mostert Schoeman Lombard'],
  AU: ['Jack Dax Lachlan Cooper Mitch Jarrah Hamish Angus Lachie Brodie Callum Darcy Fletcher Harrison Jaxon Kane Lincoln Mackenzie Nate Riley Tate Will Zac Bailey Corey Jayden Rhys Toby Ashton Blake',
       'Tanner Renner Hollis Maddock Carew Whelan Fitzpatrick Kennedy Gillespie Hutchison McAllister Pearce Rowe Sheridan Thurlow Vickers Ward Ashcroft Brennan Cartwright Doyle Ellery Fairfax Gilmour Hartigan Irvine Jardine Kingston Lowe Mahony Nolan Prendergast Quinlan Radford Somerville Tolhurst Upton Waddell Bowditch Colquhoun'],
  NZ: ['Tane Kieran Josh Wiremu Ben Hamish Rawiri Nikau Manaia Tama Hemi Ari Kauri Rangi Mikaere Lachlan Liam Fraser Angus Caleb Finn Jonah Ollie Riley Taine Mason Kane Jake Sam Tom',
       'Parata Ngata Tuhoe Rangi Fairlie Mackie Walker Thompson Wilson Taylor Anderson Campbell Robertson Stewart Murray Kerr Ruawai Tipene Hohaia Paewai Tawhiri TeWhare Waititi Pomare Horomona Henare Kingi Rewiti Matenga Tamihana Hetaraka Morrison Cunningham Galbraith Lockie McLeod Patterson Sinclair Gillies Hollis'],
  JP: ['Kenji Yuto Haruki Daichi Ren Sota Takumi Shota Kaito Riku Hayato Yuki Kazuki Ryota Shun Taiga Hiroto Naoki Kosuke Masato Ryo Kenta Daiki Tomoya Yusuke Keita Sho Takeru Hiroki Itsuki',
'Morimoto Arai Kuroda Hayashi Nomura Ogawa Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato Yoshida Yamada Sasaki Yamaguchi Matsumoto Inoue Kimura Shimizu Yamazaki Mori Abe Ikeda Hashimoto Maeda Fujita Okada Goto Hasegawa Murakami Kondo Ishii Sakamoto Endo'],
  KR: ['Seo-jun Jae-won Min-ho Tae-yang Ji-hoon Dong-hyun Hyun-woo Joon-young Sung-min Woo-jin Ye-jun Do-yoon Ha-jun Eun-woo Ji-ho Jun-seo Min-jae Hyun-soo Sang-hoon Young-ho Seung-hyun Jin-woo Tae-hoon',
'Bae Shin Kwon Yoon Jang Seo Kim Lee Park Choi Jung Kang Cho Lim Han Oh Song Hwang Ahn Hong Yoo Jeon Ko Moon Yang Son Baek Heo Nam Noh Ha Kwak Sung Cha Joo Woo Min Ryu Na Jin'],
  CN: ['Wei Hao Jun Lei Bo Cheng Zihao Haoran Yuxuan Jiahao Zhiwei Mingyu Tianyi Junjie Yifan Xinyu Ruihan Jinlong Kaiwen Zhenyu Yuchen Bowen Shuo Peng Tao Kai Yang Jie Xiang Long',
       'Zhang Liu Xu Gao Tang Luo Wang Li Chen Yang Huang Zhao Wu Zhou Sun Ma Zhu Hu Guo He Lin Zheng Liang Xie Song Han Feng Deng Cao Peng Zeng Xiao Tian Dong Pan Yuan Cai Jiang Yu Du'],
  TH: ['Somchai Kiet Anan Preecha Narong Chai Kittipong Thanawat Wanchai Pongsak Sarawut Chatchai Kriangsak Rattanon Supachai Teerapat Wichai Yuthana Apichat Banchob Chakrit Danai Ekkachai',
'Prasert Wongsa Charoen Suwan Thongdee Rattana Srisawat Saetang Chaiyaporn Wongwanich Khrongpha Sriboonrueang Phonthong Boonma Somboon Sukjai Chantarasak Pholsri Inthasorn Thanomsak Siriporn Kongsuk Yodsuwan Ruangrit Sangthong Wattanakul Phrommin Kasemsri Thammasat Srisuk Boonyarit Kittisak Thongkham Sirisuk Panyarat Saengchan Chaisiri'],
  IN: ['Arjun Rohan Kabir Vikram Aditya Nikhil Rahul Karan Siddharth Aarav Vihaan Ishaan Shiv Manav Yash Pranav Tushar Varun Akshay Rashid Udayan Dhruv Neeraj',
'Mehta Bhatia Sandhu Rao Chopra Gill Sharma Verma Gupta Singh Kapoor Malhotra Iyer Nair Reddy Menon Joshi Patel Desai Kulkarni Randhawa Sethi Saxena Agarwal Banerjee Mukherjee Chatterjee Pillai Shetty Deshpande Thakur Chauhan Rathore Bajwa Grewal Dhillon Sodhi'],
  CO: ['Mateo Camilo Santiago Andres Felipe Julian Sebastian Nicolas Juan Daniel David Alejandro Esteban Mauricio Ricardo Diego Carlos Oscar Gabriel Manuel Samuel Tomas Simon Emilio Alvaro Gustavo Jaime Hernan Ivan',
'Quintero Restrepo Cardona Ospina Zapata Arango Gomez Rodriguez Martinez Lopez Gonzalez Henao Jaramillo Mejia Velez Escobar Echeverri Giraldo Montoya Botero Uribe Correa Alzate Londono Salazar Cifuentes Bermudez Castano Duque Franco Gaviria Marulanda Orozco Patino Rendon Toro Vallejo Agudelo Betancur'],
  AR: ['Nico Tomas Franco Lautaro Joaquin Bruno Facundo Agustin Ignacio Santiago Matias Emiliano Gonzalo Federico Leandro Martin Andres Ezequiel Julian Mariano Alejo Valentin Benjamin Thiago Bautista Felipe Lisandro Maximo Rodrigo Pablo',
'Santoro Paredes Ledesma Quiroga Sosa Villalba Fernandez Gomez Diaz Alvarez Acosta Benitez Medina Herrera Suarez Aguirre Gimenez Molina Rojas Castro Ortiz Pereyra Silva Ferreyra Godoy Cabrera Vega Correa Figueroa Rios Peralta Luna Juarez Cardozo Arias Ponce Bustos Maldonado Navarro'],
};
export const NAMES2: Record<string, { f: string[]; l: string[] }> = {};
for (const c in RAW) {
  const f = [...new Set(RAW[c][0].split(' '))], l = [...new Set(RAW[c][1].split(' '))];
  NAMES2[c] = { f, l };
}
// surnames written as one word above get their spaces back
const SPACED: Record<string, string> = { DeJong: 'de Jong', DeVries: 'de Vries', VanDijk: 'van Dijk', DeBoer: 'de Boer', DeGroot: 'de Groot', VanLeeuwen: 'van Leeuwen', VanDam: 'van Dam', VandenBerg: 'van den Berg', VanderMerwe: 'van der Merwe', DuPlessis: 'du Plessis', VanWyk: 'van Wyk', DeLuca: 'De Luca', TeWhare: 'Te Whare' };
const fix = (s: string) => SPACED[s] || s;
// a name nobody in `taken` already has (lower-cased), for golfers from country c
export function uniqueName(c: string, taken: Set<string>, rnd: () => number = Math.random): string {
  const N = NAMES2[c] || NAMES2.US;
  for (let t = 0; t < 400; t++) {
    const n = N.f[Math.floor(rnd() * N.f.length)] + ' ' + fix(N.l[Math.floor(rnd() * N.l.length)]);
    if (!taken.has(n.toLowerCase())) { taken.add(n.toLowerCase()); return n; }
  }
  // every pairing taken (very unlikely): try a hyphenated surname
  for (;;) {
    const n = N.f[Math.floor(rnd() * N.f.length)] + ' ' + fix(N.l[Math.floor(rnd() * N.l.length)]) + '-' + fix(N.l[Math.floor(rnd() * N.l.length)]);
    if (!taken.has(n.toLowerCase())) { taken.add(n.toLowerCase()); return n; }
  }
}
