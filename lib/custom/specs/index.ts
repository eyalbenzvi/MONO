/**
 * The later Make products' spec modules, by template id (each product is its
 * own template). lib/custom/spec validates through them; lib/custom/products
 * lists the ones that ship.
 */
import type { SpecModule } from "./types";
import * as weeks from "./weeks";
import * as elements from "./elements";
import * as crossword from "./crossword";
import * as journey from "./journey";
import * as snowflake from "./snowflake";
import * as maze from "./maze";
import * as automaton from "./automaton";
import * as julia from "./julia";
import * as rings from "./rings";
import * as family from "./family";
import * as orbits from "./orbits";
import * as tartan from "./tartan";
import * as musicbox from "./musicbox";
import * as monogram from "./monogram";
import * as chess from "./chess";
import * as metro from "./metro";
import * as route from "./route";
import * as island from "./island";
import * as qr from "./qr";
import * as telegram from "./telegram";
import * as editions from "./editions";
import * as sayings from "./sayings";
import * as label from "./label";
import * as credits from "./credits";
import * as card from "./card";
import * as receipt from "./receipt";
import * as message from "./message";
import * as birth from "./birth";
import * as sign from "./sign";
import * as signpost from "./signpost";
import * as tour from "./tour";
import * as lineup from "./lineup";

export const EXTRA = { weeks, elements, crossword, journey, snowflake, maze, automaton, julia, rings, family, orbits, tartan, musicbox, monogram, chess, metro, route, island, qr, telegram, editions, sayings, label, credits, card, receipt, message, birth, sign, signpost, tour, lineup };
export type ExtraId = keyof typeof EXTRA;
export type ExtraParams = { [K in ExtraId]: (typeof EXTRA)[K] extends SpecModule<infer P> ? P : never };
export type ExtraSpec = { [K in ExtraId]: { t: K; v: 1; p: ExtraParams[K] } }[ExtraId];
