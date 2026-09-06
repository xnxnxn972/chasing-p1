export type Series = 'F4' | 'F3' | 'F2' | 'F1';

export const SERIES_ORDER: Series[] = ['F4', 'F3', 'F2', 'F1'];

export type F1TeamId =
  | 'mclaren'
  | 'mercedes'
  | 'ferrari'
  | 'red_bull'
  | 'racing_bulls'
  | 'williams'
  | 'aston_martin'
  | 'haas'
  | 'alpine'
  | 'audi'
  | 'cadillac';

export type DrivingStyle = 'speed' | 'technical' | 'physical';

export type ContractRole = 'rookie' | 'number_two' | 'equal' | 'team_leader';

export interface TeamCarProfile {
  stability: number;
  tyreManagement: number;
  straightLineSpeed: number;
  aeroSensitivity: number;
  developmentPotential: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  series: Series;
  colour: string;
  /** Live, evolving pace. Everything else is identity or behaviour. */
  carPerformance: number;
  development: number;
  prestige: number;
  stability: number;
  pressure: number;
  salaryPower: number;
  juniorDevelopment: number;
  driverOpportunity: number;
  championshipExpectation: number;
  reliability: number;
  carProfile: TeamCarProfile;
}

export interface DriverStats {
  pace: number;
  qualifying: number;
  racecraft: number;
  consistency: number;
  technical: number;
  fitness: number;
}

export interface CareerStats {
  reputation: number;
  marketability: number;
  teamRelationship: number;
  wealth: number;
}

export interface SimDriver {
  id: string;
  name: string;
  nationality: string;
  flag: string;
  age: number;
  style: DrivingStyle;
  stats: DriverStats;
  overall: number;
  potential: number;
  reputation: number;
  teamId?: string;
  series: Series | 'retired' | 'none';
  titles: number;
  wins: number;
  podiums: number;
  poles: number;
  starts: number;
  /** Seasons the player has finished ahead of / behind this driver. */
  clashes: number;
  isPlayer?: boolean;
}

export interface Contract {
  teamId: string;
  startYear: number;
  seasons: number;
  salary: number;
  role: ContractRole;
  performanceClause?: boolean;
}

export interface SeasonResult {
  year: number;
  age: number;
  series: Series;
  teamId: string;
  teamName: string;
  driverOverallStart: number;
  driverOverallEnd: number;
  races: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  dnfs: number;
  points: number;
  championshipPosition: number;
  teamChampionshipPosition?: number;
  /** F1 only — who won the drivers' title that year. */
  champion?: string;
  salary: number;
  reserveYear?: boolean;
}

export interface StandingRow {
  driverId: string;
  name: string;
  flag: string;
  teamId: string;
  teamName: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  dnfs: number;
  isPlayer: boolean;
}

export interface ConstructorRow {
  teamId: string;
  teamName: string;
  points: number;
  colour: string;
}

export interface SeasonReport {
  result: SeasonResult;
  standings: StandingRow[];
  constructors: ConstructorRow[];
  headlines: string[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  score: number;
  year?: number;
}

export interface ContractOffer {
  id: string;
  teamId: string;
  teamName: string;
  colour: string;
  series: Series;
  salary: number;
  seasons: number;
  role: ContractRole;
  performanceClause: boolean;
  /** Fuzzy, player-facing car estimate — never the raw number. */
  carEstimate: string;
  carStars: number;
  expectation: string;
  pitch: string;
  isAcademy?: boolean;
  isReserve?: boolean;
}

export interface DecisionOption {
  id: string;
  label: string;
  detail?: string;
  pros?: string[];
  cons?: string[];
}

export interface PendingDecision {
  eventId: string;
  kind: 'decision';
  tag: string;
  title: string;
  body: string;
  options: DecisionOption[];
}

export interface PendingOffers {
  kind: 'offers';
  tag: string;
  title: string;
  body: string;
  offers: ContractOffer[];
  /** Present when the player is allowed to hold out for something better. */
  canDecline: boolean;
  declineLabel?: string;
}

export interface PendingResult {
  kind: 'result';
  report: SeasonReport;
  newAchievements: Achievement[];
  notes: string[];
}

export interface PendingNews {
  kind: 'news';
  tag: string;
  title: string;
  body: string;
  continueLabel: string;
}

export type PendingStep =
  | PendingDecision
  | PendingOffers
  | PendingResult
  | PendingNews;

export type Cursor =
  | 'contract'
  | 'preseason'
  | 'midseason'
  | 'race'
  | 'offseason'
  | 'advance'
  | 'retired';

export interface PlayerDriver {
  name: string;
  number: number;
  nationality: string;
  flag: string;
  style: DrivingStyle;
  age: number;
  stats: DriverStats;
  overall: number;
  potential: number;
  form: number;
  career: CareerStats;
  series: Series;
  teamId: string;
  contract: Contract;
  academyTeamId?: F1TeamId;
  /** Seasons of F1 reserve duty done, used by promotion logic. */
  reserveSeasons: number;
  careerEarnings: number;
  retiredAge?: number;
}

export interface CareerTotals {
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  titles: number;
  f1Starts: number;
  f1Wins: number;
  f1Podiums: number;
  f1Poles: number;
  f1FastestLaps: number;
  juniorTitles: number;
}

export interface GameState {
  seed: string;
  year: number;
  cursor: Cursor;
  rngState: number;
  player: PlayerDriver;
  teams: Record<string, Team>;
  drivers: Record<string, SimDriver>;
  seats: Record<F1TeamId, [string | undefined, string | undefined]>;
  history: SeasonResult[];
  achievements: Achievement[];
  relationships: Record<F1TeamId, number>;
  firedEvents: string[];
  pending: PendingStep | null;
  log: string[];
  /** Set while the player is an F1 reserve rather than a race driver. */
  reserveTeamId?: F1TeamId;
  retirementOffered: boolean;
  retireRequested: boolean;
  regulationYears: number[];
  /** Pace rank of each team at the moment the player signed for it. */
  joinPaceRank: Record<string, number>;
  rivalId?: string;
  finished: boolean;
}
