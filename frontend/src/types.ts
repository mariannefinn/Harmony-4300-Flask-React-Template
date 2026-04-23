export interface Song {
  title: string;
  artist: string;
  similarity: number;
  match_type?: "exact" | "similar";
  cosine_score: number;
  svd_score: number;
  chords: string;
  guitar_difficulty: number;
  piano_difficulty: number;
  difficulty: number;
  genres: string[];
  svd_explanation: {
    dimension: number;
    strength: number;
    mood_words: string[];
  }[];
}
