use std::io::{self, Read};
use std::env;
use regex::Regex;

fn main() {
    let args: Vec<String> = env::args().collect();
    let prolog_reg = &args[1];
    let func_reg = &args[2];
    let pos_reg = &args[3];
    let mut input = String::new();
    match io::stdin().read_to_string(&mut input) {
        Ok(_) => {
            let rsp = Regex::new(r"[^\s]").unwrap(); 
            let mut res: String = rsp.replace_all(&input, " ").into_owned();
            let len = prolog_reg.len();
            res.replace_range(0..len,&prolog_reg);
            let re = Regex::new(r"(?s)\bAPI[.]([A-Z]+)`(\s+.*)[$][$]`").unwrap();
            let mut positions: Vec<usize> = Vec::new();
            for caps in re.captures_iter(&input) {
                let Some(c) = caps.get(0) else { panic!("!!!"); }; 
                res.replace_range(c.start()..c.end()
                    // ,   &format!("$⛑_{}({} );", &caps[1], &caps[2]) 
                    , &func_reg
                        .replace("[:METHOD:]", &caps[1])
                        .replace("[:BODY:]", &caps[2])
                    );
                positions.push(c.start());
            } 
            print!("{}",res);
            println!("");
            // println!("$⛑({:?});", positions);
            let pos = format!("{:?}", positions);
            println!("{}", pos_reg.replace("[:POSITIONS:]", &pos));
        }
        Err(error) => println!("Error: {}", error),
    }

}
