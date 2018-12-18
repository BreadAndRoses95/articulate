import axios from 'axios';


let http = axios.create({
  baseURL: process.env.TOKEN_ENDPOINT ? process.env.TOKEN_ENDPOINT : '',
})

export default class LoginService{
  static loginRequest(credentials){
    return http.post('?useDeflate=false',credentials)
  }
}
