export type ShareBackgroundMode="transparent"|"photo"|"solid"|"gradient";
export type ShareFormat="square"|"story"|"sticker";
export type ShareTextTone="light"|"dark";
export type ShareSport="strength"|"run"|"bike"|"swim"|"row"|"walk_hike"|"elliptical"|"cross_training"|"custom";

export type ShareMetric={label:string;value:string};

export type ShareCardData={
  id:string;
  kind:"workout"|"pb";
  sport:ShareSport;
  label:string;
  title:string;
  result:string;
  secondary?:string;
  improvement?:string;
  previous?:string;
  date?:string;
  metrics:ShareMetric[];
};

export type ShareRenderOptions={
  background:ShareBackgroundMode;
  format:ShareFormat;
  accent:string;
  textTone:ShareTextTone;
  photoUrl?:string;
  photoX:number;
  photoY:number;
};
