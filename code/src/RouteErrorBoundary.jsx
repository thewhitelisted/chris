import { Component } from 'react'

class RouteErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="content-page">
          <p className="post-paragraph" role="alert">Could not load this page ({this.state.error.message}).</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default RouteErrorBoundary
