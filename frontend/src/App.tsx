import { useState, useEffect } from 'react'
import './App.css'
import SearchIcon from './assets/mag.png'
import Logo from './assets/harmony_logo.png'
import { Song } from './types'
// import Chat from './Chat'
import RAG from './RAG'

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
    const response = await fetch(
      `/api/songs?title=${encodeURIComponent(value)}&topn=${encodeURIComponent(numResults)}&instrument=${encodeURIComponent(instrument)}&difficulty=${encodeURIComponent(difficulty)}&exact=${exactMatch}&genre=${encodeURIComponent(genre)}`
    )
    const data = await response.json()
    setSongs(data.results ?? [])
  }

  if (useLlm === null) return <></>

  return (
    <div className={`full-body-container ${useLlm ? 'llm-mode' : ''}`}>
      {/* Search bar (always shown) */}
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
                placeholder="Search for a song you want to learn"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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

        {/* Search results (always shown) */}
        < div id="answer-box" >
          {
            songs.map((song, index) => (
              <div key={index}>

                {/* SECTION LABEL (outside song box) */}
                {exactMatch &&
                  song.match_type === "similar" &&
                  index > 0 &&
                  songs[index - 1]?.match_type !== "similar" && (
                    <div
                      style={{
                        margin: '1.25rem 0 0.5rem 0',
                        fontSize: '0.95em',
                        color: '#aaa'
                      }}
                    >
                      Similar songs based on your search:
                    </div>
                  )
                }

                {/* SONG CARD */}
                <div className="song-item">
                  <h3 className="song-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
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
                    </span>

                    {song.match_type !== "exact" && (
                      <span>Similarity: {song.similarity}%</span>
                    )}
                  </h3>

                  <h4 className="song-artist">by {song.artist}</h4>
                  <p className="song-chords">Chords: {song.chords}</p>
                  <p className="song-difficulty">Difficulty: {song.difficulty}/10</p>
                  <p className="song-genres">Genres: {song.genres?.join(", ")}</p>

                  {song.match_type !== "exact" && song.svd_explanation?.length > 0 && (
                    <p
                      className="song-scores"
                      style={{ display: 'flex', gap: '1rem', fontSize: '0.85em', color: '#888' }}
                    >
                      <span>Cosine: {song.cosine_score}%</span>
                      <span>SVD: {song.svd_score}%</span>
                    </p>
                  )}

                  {song.match_type !== "exact" && song.svd_explanation?.length > 0 && (
                    <div className="svd-explanation">
                      <strong>SVD Mood Analysis</strong>
                      <br />
                      <strong>Dimensions:</strong>
                      {song.svd_explanation.map((dim, i) => (
                        <div key={i}>
                          <div className={dim.strength > 0 ? 'pos-dim' : 'neg-dim'}>{dim.dimension}: {dim.strength}</div>
                          <div className='moods'>
                            Mood words: {dim.mood_words.join(', ')}
                          </div>


                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ))
          }
        </div >
        <div className="no-result">
          {hasSearched && exactMatch && lastSearchSubmitted.trim() !== '' && songs.length === 0 && (
            <p>No result found!</p>
          )}
        </div>
        <div className="filter-title">
        </div>
        <div id="filter-box">
          <div className="filters">
            <div className="filter-title">
              <h1>Pick An Instrument!</h1>
            </div>
            <div className="btn-groupH">
              <button className={instrument === "guitar" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setInstrument("guitar")
              }}>
                Guitar
              </button>
              <button className={instrument === "piano" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setInstrument("piano")
              }}>
                Piano
              </button>
            </div>
            <div className="filter-title">
              <h1>Pick A Difficulty!</h1>
            </div>
            <div className="btn-groupV">
              <button className={difficulty === "all" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("all")
              }}>
                All
              </button>
              <button className={difficulty === "easy" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("easy")
              }}>
                Easy
              </button>
              <button className={difficulty === "medium" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("medium")
              }}>
                Medium
              </button>
              <button className={difficulty === "hard" ? "active-filter-btn" : "filter-btn"} onClick={() => {
                setDifficulty("hard")
              }}>
                Hard
              </button>
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
                    if (genre !== "all") {
                      setGenreInput(genre)
                    }
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
                    <span
                      className="genre-clear-btn"
                      onClick={() => {
                        setGenre("all")
                        setGenreInput("")
                      }}
                    >
                    </span>
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
      </div>

      {/* Chat (only when USE_LLM = True in routes.py) */}
      {/* {useLlm && <Chat onSearchTerm={handleSearch} />} */}
      {useLlm && (
        <RAG
          instrument={instrument}
          difficulty={difficulty}
          numResults={numResults}
        />
      )}
    </div >
  )
}

export default App

