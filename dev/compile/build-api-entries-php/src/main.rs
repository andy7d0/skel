use std::io::{self, Read};
use regex::Regex;

fn main() {
    let mut input = String::new();
    match io::stdin().read_to_string(&mut input) {
        Ok(_) => {
            let rsp = Regex::new(r"[^\s]").unwrap(); 
            let mut res: String = rsp.replace_all(&input, " ").into_owned();
            res.replace_range(0..6,"<?php ");
            let re = Regex::new(r"(?s)\bAPI[.]([A-Z]+)`(\s+.*)[$][$]`").unwrap();
            let mut positions: Vec<usize> = Vec::new();
            for caps in re.captures_iter(&input) {
                let Some(c) = caps.get(0) else { panic!("!!!"); }; 
                res.replace_range(c.start()..c.end()
                    ,   &format!("$⛑_{}({} );", &caps[1], &caps[2]) 
                    );
                positions.push(c.start());
            } 
            print!("{}",res);
            println!("");
            println!("$⛑({:?});", positions);
        }
        Err(error) => println!("Error: {}", error),
    }

}
