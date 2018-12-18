import React from 'react';
import Content from '../../components/Content';
import ContentHeader from '../../components/ContentHeader';
import Header from '../../components/Header';
import {createStructuredSelector} from 'reselect';
import ActionButton from '../../components/ActionButton';
import FormTextInput from '../../components/FormTextInput';
import Form from '../../components/Form';
import {
  Col,
  Row,
} from 'react-materialize';


import messages from './messages';
import {connect} from "react-redux";
import {changeSettingsData, requestLogin, resetStatusFlags} from "../App/actions";


export class LoginApiPage extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  
  constructor() {
    super();
    this.submitForm = this.submitForm.bind(this);
    this.state = {
      loginUsername: "",
      loginPassword: ""
    };
  }
  
  handleChange = event => {
    console.log(event.target.id)
    this.setState({
      [event.target.id]: event.target.value
    });
  }
  
  submitForm(evt) {
    if (evt !== undefined && evt.preventDefault) evt.preventDefault();
    console.log("sumbit" + evt)
    this.props.onSubmit(this.state)
    
  }
  
  render() {
    let breadcrumbs = [
      {
        label: 'Login',
        id: 'Login'
      }
    ]
    return (
      <div>
        <Header breadcrumbs={breadcrumbs}
                actionButtons={<ActionButton label={messages.loginButton} onClick={this.submitForm}/>}/>
        <Content>
          <Form>
            <Row>
              <FormTextInput
                id='loginUsername'
                label={messages.loginUserName}
                value={this.state.loginUsername}
                onChange={this.handleChange}
                required
              />
            </Row>
            <Row>
              <FormTextInput
                id='loginPassword'
                label={messages.loginPassword}
                value={this.state.loginPassword}
                onChange={this.handleChange}
                required
                type='password'
              />
            </Row>
          </Form>
        </Content>
      </div>
    );
  }
}

LoginApiPage.propTypes = {}


export function mapDispatchToProps(dispatch) {
  return {
    onSubmit: (credentials) => {
      dispatch(requestLogin(credentials));
    },
  }
}

const mapStateToProps = createStructuredSelector({})

export default connect(mapStateToProps, mapDispatchToProps)(LoginApiPage);
