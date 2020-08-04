import React from 'react';
import MovieCard from './movie-card';

class HomePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tab: 'trending' };
    this.switchTab = this.switchTab.bind(this);
  }

  componentDidMount() {
    this.props.getTrending('trending');
  }

  switchTab(category) {
    this.setState({ tab: category });
    this.props.getTrending(category);
  }

  render() {
    let link1;
    let link2;
    if (this.state.tab === 'trending') {
      link1 = 'nav-link active';
      link2 = 'nav-link';
    } else {
      link2 = 'nav-link active';
      link1 = 'nav-link';
    }

    return (<>
      <h1>Home Page- placeholder</h1>
      <div className="container">
        <ul className="nav nav-tabs">
          <li className="nav-item">
            <button className={link1} onClick={() => this.switchTab('trending')} styles={{ outline: 'none' }}>Trending Today</button>
          </li>
          <li className="nav-item">
            <button className={link2} onClick={() => this.switchTab('top')}>Top Rated</button>
          </li>
        </ul>
        <div className="row justify-content-center">
          {this.props.results.map(item => (
            <MovieCard key={item.id} poster_path={item.poster_path} />
          ))}
        </div>
      </div>

    </>);
  }
}

export default HomePage;
