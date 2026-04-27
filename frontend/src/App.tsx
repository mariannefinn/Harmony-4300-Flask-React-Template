import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import Logo from './assets/harmony_logo.png'
import { Song } from './types'
import Chat from './Chat'
// import RAG from './RAG'

function App(): JSX.Element {
  const [useLlm, setUseLlm] = useState<boolean | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [songs, setSongs] = useState<Song[]>([])
  const [numResults, setNumResults] = useState(5)
  const [hasSearched, setHasSearched] = useState(false)
  const [lastSearchSubmitted, setLastSearchSubmitted] = useState("")
  const [exactMatch, setExactMatch] = useState<boolean>(false)
  const [instrument, setInstrument] = useState<string>('guitar')
  const [difficulty, setDifficulty] = useState<string>('all')
  const [genre, setGenre] = useState<string>("all")
  const [genreOptions, setGenreOptions] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState<string>("")
  const [selectedSong, setSelectedSong] = useState<{ id: number, title: string, artist: string } | null>(null) // new
  const [suggestions, setSuggestions] = useState<any[]>([]) //new

  useEffect(() => {
    fetch('/api/genres').then(r => r.json()).then(data => setGenreOptions(data))
  }, [])

  useEffect(() => {
    handleSearch(searchTerm);
  }, [instrument, difficulty, exactMatch, genre]);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => setUseLlm(data.use_llm))
  }, [])

  const handleSearch = async (value: string): Promise<void> => {
    setHasSearched(true)
    setLastSearchSubmitted(value)
    if (value.trim() === '') {
      setSongs([])
      return
    }

    const queryParam = exactMatch && selectedSong
      ? `song_id=${selectedSong.id}`
      : `title=${encodeURIComponent(value)}`

    const response = await fetch(
      `/api/songs?${queryParam}&topn=${encodeURIComponent(numResults)}&instrument=${encodeURIComponent(instrument)}&difficulty=${encodeURIComponent(difficulty)}&exact=${exactMatch}&genre=${encodeURIComponent(genre)}`
    )
    const data = await response.json()
    setSongs(data.results ?? [])

  }

  const fetchSuggestions = async (value: string) => {
    if (!value) {
      setSuggestions([])
      return
    }

    const res = await fetch(`/api/song_titles?q=${encodeURIComponent(value)}`)
    const data = await res.json()
    setSuggestions(data)
  } //new

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>

      {/* top header + search */}
      <div className="top-text">

        <div className="title">
          <img src={Logo} alt="logo" />
          <h1>Harmony</h1>
        </div>

        <div className="search-row">

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch(searchTerm)
            }}
            className="search-form"
          >
            <div className="input-box">
              <img src={SearchIcon} alt="search" />
              <input
                id="search-input"
                placeholder={
                  exactMatch
                    ? "Search for a specific song to learn (e.g. Let It Be, Bohemian Rhapsody)"
                    : "Search for a vibe (e.g. sad rainy day, happy summer road trip)"
                }
                value={exactMatch ? (selectedSong?.title || searchTerm) : searchTerm}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchTerm(val)

                  if (exactMatch) {
                    setSelectedSong(null)
                    fetchSuggestions(val)
                  }
                }} /* new */
              // value={searchTerm}
              // onChange={(e) => setSearchTerm(e.target.value)}
              />

              {exactMatch && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="suggestion-item"
                      onClick={() => {
                        setSelectedSong(s)
                        setSearchTerm(s.title)
                        setSuggestions([])
                      }}
                    >
                      {s.title} — {s.artist}
                    </div>
                  ))}
                </div>
              )} {/* new */}
            </div>

            <div className="search-button">
              <button type="submit" className="button">
                Search
              </button>
            </div>
          </form>

          <div className="exact-toggle">
            <span className="exact-toggle-label">Exact Song Match</span>

            <label className="exact-switch">
              <input
                type="checkbox"
                checked={exactMatch}
                onChange={(e) => setExactMatch(e.target.checked)}
              />
              <span className="exact-slider"></span>
            </label>
          </div>

        </div>
        {/* no results */}
        {/* <div className="no-result">
          {hasSearched &&
            exactMatch &&
            lastSearchSubmitted.trim() !== '' &&
            songs.length === 0 && (
              <p>No result found!</p>
            )}
        </div> */} {/* new */}
      </div>

      {/* layout */}
      <div className="main-layout">

        {/* filters */}
        <div id="filter-box">

          <div className="filters">

            <div className="filter-title">
              <h1>Pick An Instrument!</h1>
            </div>

            <div className="btn-groupH">
              <button
                className={instrument === "guitar" ? "active-filter-btn" : "filter-btn"}
                onClick={() => setInstrument("guitar")}
              >
                Guitar
              </button>
              <button
                className={instrument === "piano" ? "active-filter-btn" : "filter-btn"}
                onClick={() => setInstrument("piano")}
              >
                Piano
              </button>
            </div>

            <div className="filter-title">
              <h1>Pick A Difficulty!</h1>
            </div>

            <div className="btn-groupV">
              <button className={difficulty === "all" ? "active-filter-btn" : "filter-btn"} onClick={() => setDifficulty("all")}>All</button>
              <button className={difficulty === "easy" ? "active-filter-btn" : "filter-btn"} onClick={() => setDifficulty("easy")}>Easy</button>
              <button className={difficulty === "medium" ? "active-filter-btn" : "filter-btn"} onClick={() => setDifficulty("medium")}>Medium</button>
              <button className={difficulty === "hard" ? "active-filter-btn" : "filter-btn"} onClick={() => setDifficulty("hard")}>Hard</button>
            </div>

            <div className="filter-title">
              <h1>Pick A Genre!</h1>
            </div>

            <div className="genre-autocomplete">
              <div className="genre-input-wrapper">
                <input
                  value={genreInput}
                  placeholder={genre === "all" ? "Type a genre..." : ""}
                  onFocus={() => {
                    if (genre !== "all") setGenreInput(genre)
                  }}
                  onChange={(e) => {
                    const val = e.target.value
                    setGenreInput(val)

                    const match = genreOptions.find(
                      g => g.toLowerCase() === val.toLowerCase()
                    )

                    if (match) setGenre(match)
                    else if (val.trim() === "") setGenre("all")
                  }}
                />

                {genre !== "all" && genreInput === "" && (
                  <div className="genre-selected-inline">
                    {genre}
                  </div>
                )}
              </div>

              {genreInput && (
                <div className="genre-suggestions">
                  {genreOptions
                    .filter(g =>
                      g.toLowerCase().includes(genreInput.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((g, i) => (
                      <div
                        key={i}
                        className="genre-suggestion"
                        onClick={() => {
                          setGenre(g)
                          setGenreInput("")
                        }}
                      >
                        {g}
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div>
              <div className="filter-title">
                <h1># of Results</h1>
              </div>

              <input
                className="slider"
                type="range"
                min="1"
                max="10"
                step="1"
                value={numResults}
                onChange={(e) => setNumResults(Number(e.target.value))}
              />

              <div className="slider-labels">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

          </div>
        </div>

        {/* results */}
        <div id="answer-box">

          {songs.map((song, index) => (

            <div key={index}>

              {exactMatch &&
                song.match_type === "similar" &&
                index > 0 &&
                songs[index - 1]?.match_type !== "similar" && (
                  <div className="similar-header">
                    Similar songs based on your search:
                  </div>
                )
              }

              {/* song result */}
              <div className="song-item">

                <h3 className="song-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {song.title}
                  {song.match_type === "exact" && (
                    <span style={{
                      marginLeft: '0.5rem',
                      color: '#4caf50',
                      fontSize: '0.8em'
                    }}>
                      (Exact Match)
                    </span>
                  )}
                  {song.match_type !== "exact" && (
                    <span>Similarity: {song.similarity}%</span>
                  )}
                </h3>

                <h4 className="song-artist">by {song.artist}</h4>

                <p className="song-chords">Chords: {song.chords}</p>
                <p className="song-difficulty">Difficulty: {song.difficulty}/10</p>
                <p className="song-genres">Genres: {song.genres?.join(", ")}</p>

                {song.match_type !== "exact" && song.cosine_score && song.svd_score && (
                  <p style={{ fontSize: '0.85em', color: '#888', marginTop: '0.5rem' }}>
                    Cosine: {song.cosine_score}% | SVD: {song.svd_score}%
                  </p>
                )}

                {song.match_type !== "exact" && song.svd_explanation?.length > 0 && (
                  <div className="svd-explanation" style={{ marginTop: '0.75rem' }}>
                    <strong>SVD Mood Analysis</strong>
                    {song.svd_explanation.map((dim, i) => (
                      <div key={i}>
                        <strong>Dimension {dim.dimension}</strong> (strength: {dim.strength})
                        <br />
                        Mood words: {dim.mood_words.join(', ')}
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </div>
          ))}

        </div>

        {/* explanation */}
        {hasSearched && lastSearchSubmitted.trim() !== '' && (
          <div className="explanation-box">

            {exactMatch ? (
              <>
                <h3>🎵 How Results Are Ranked</h3>

                <p>
                  <strong>Exact Match</strong><br />
                  The top result is the exact song you searched for.
                </p>

                <p>
                  <strong>Similar Songs</strong><br />
                  Ranked using <strong>70% lyrics</strong> and <strong>30% chord similarity</strong>.
                </p>

                <p style={{ opacity: 0.8 }}>
                  This balances emotional and musical similarity.
                </p>
              </>
            ) : (
              <>
                <h3>📊 How Similarity is Calculated</h3>

                <p>
                  <strong>Cosine Score</strong><br />
                  Measures similarity between song lyric embeddings using cosine distance.
                  Higher values mean more similar semantic meaning.
                </p>

                <p>
                  <strong>SVD Score</strong><br />
                  Computed using Singular Value Decomposition on the song feature matrix,
                  capturing latent musical structure and mood patterns.
                </p>

                <p>
                  <strong>Final Similarity Score</strong><br />
                  The displayed similarity is the <strong>average of Cosine Score and SVD Score</strong>.
                </p>

                <p style={{ opacity: 0.8 }}>
                  This combines lyrical meaning and musical structure for better recommendations.
                </p>
              </>
            )}

          </div>
        )}

      </div>

      {/* rag mode */}
      {useLlm && (
        <Chat
          instrument={instrument}
          difficulty={difficulty}
          numResults={numResults}
        />
      )}

    </div>
  )
}

export default App

