
const Sequelize = require('sequelize');

const {log, biglog, errorlog, colorize} = require("./out");

const {models} = require('./model');


/**
 * Muestra la ayuda.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */
exports.helpCmd = (socket, rl) => {
    log(socket,"Commandos:");
    log(socket,"  h|help - Muestra esta ayuda.");
    log(socket,"  list - Listar los quizzes existentes.");
    log(socket,"  show <id> - Muestra la pregunta y la respuesta el quiz indicado.");
    log(socket,"  add - Añadir un nuevo quiz interactivamente.");
    log(socket,"  delete <id> - Borrar el quiz indicado.");
    log(socket,"  edit <id> - Editar el quiz indicado.");
    log(socket,"  test <id> - Probar el quiz indicado.");
    log(socket,"  p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
    log(socket,"  credits - Créditos.");
    log(socket,"  q|quit - Salir del programa.");
    rl.prompt();
};


/**
 * Lista todos los quizzes existentes en el modelo.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */
exports.listCmd = (socket, rl) => {
    models.quiz.findAll()
        .each(quiz => {
            log(socket,`[${colorize(quiz.id, 'magenta')}]:  ${quiz.question}`);
        })
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
        });
};

/**
 * Muestra el quiz indicado en el parámetro: la pregunta y la respuesta.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a mostrar.
 */

const validateId = id => {

    return new Sequelize.Promise((resolve,reject) => {
        if (typeof id === "undefined") {
            reject(new Error(`Falta el parametro <id>.`));
        } else {
            id = parseInt(id);
            if (Number.isNaN(id)) {
                reject(new Error(`El valor del parámetro <id> no es un número.`));
            } else {
                resolve(id);
            }
        }
    });
};



exports.showCmd = (socket,rl, id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if (!quiz) {
                throw new Error(`No existe un quiz asociado al id=${id}.`);
            }
            log(socket,` [${colorize(id, 'magenta')}]:  ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);

        })
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


const makeQuestion = (rl, text) => {

    return new Sequelize.Promise((resolve, reject) => {
        rl.question(colorize(text, 'red'), answer => {
            resolve(answer.trim());
        });
    });
};


/**
 * Añade un nuevo quiz al módelo.
 * Pregunta interactivamente por la pregunta y por la respuesta.
 *
 * Hay que recordar que el funcionamiento de la funcion rl.question es asíncrono.
 * El prompt hay que sacarlo cuando ya se ha terminado la interacción con el usuario,
 * es decir, la llamada a rl.prompt() se debe hacer en la callback de la segunda
 * llamada a rl.question.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */
exports.addCmd = (socket,rl) => {

    makeQuestion(rl, ' Introduzca una pregunta: ')
        .then(q => {
            return makeQuestion(rl, ' Introduzca la respuesta: ')
                .then(a => {
                    return {question: q, answer: a};
                });
        })
        .then(quiz => {
            return models.quiz.create(quiz);
        })
        .then((quiz) => {
            log(socket,` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(Sequelize.ValidationError, error => {
            errorlog(socket,'El quiz es erróneo:');
            error.errors.forEach(({message}) => errorlog(socket,message));
        })
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


/**
 * Borra un quiz del modelo.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a borrar en el modelo.
 */
exports.deleteCmd = (socket,rl, id) => {
    validateId(id)
        .then(id => models.quiz.destroy({where: {id}}))
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


/**
 * Edita un quiz del modelo.
 *
 * Hay que recordar que el funcionamiento de la funcion rl.question es asíncrono.
 * El prompt hay que sacarlo cuando ya se ha terminado la interacción con el usuario,
 * es decir, la llamada a rl.prompt() se debe hacer en la callback de la segunda
 * llamada a rl.question.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a editar en el modelo.
 */
exports.editCmd = (socket,rl, id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if(!quiz) {
                throw new Error(`No existe un quiz asociado al id=${id}.`);
            }

            process.stdout.isTTY && setTimeout(() => {socket.write(quiz.question)},0);
            return makeQuestion(rl, ' Introduzca la pregunta: ')
                .then(q => {
                    process.stdout.isTTY && setTimeout(() => {socket.write(quiz.answer)},0);
                    return makeQuestion(rl, ' Introduzca la respuesta: ')
                        .then(a => {
                            quiz.question = q;
                            quiz.answer = a;
                            return quiz;
                        });
                });
        })
        .then(quiz => {
            return quiz.save();
        })
        .then(quiz => {
            log(socket,` Se ha cambiado el quiz ${colorize(id, 'magenta')} por: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);

        })
        .catch(Sequelize.ValidationError, error => {
            errorlog(socket,'El quiz es erróneo:');
            error.errors.forEach(({message}) => errorlog(socket,message));
        })
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


/**
 * Prueba un quiz, es decir, hace una pregunta del modelo a la que debemos contestar.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a probar.
 */
exports.testCmd = (socket,rl, id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if (!quiz) {
                throw new Error(`No existe un quiz con el id=${id}.`);
            }
            return makeQuestion(rl, ` ${quiz.question}? `)
                .then(a => {
                    log(socket,` Su respuesta es: `, 'white')
                    if (a.trim().toLowerCase() === quiz.answer.toLowerCase()) {
                        biglog(socket, `Correcta`, 'green');
                    } else {
                        biglog(socket, `Incorrecta`, 'red');
                    }
                })
        })
        .catch(error => {
            errorlog(socket,error.message);
        })
        .then(() => {
            rl.prompt();

        });
};

/*const inicializa = () => {
    return new Sequelize.Promise((resolve, reject) = {
        let: score,
        let: toBeResolved = [];
        resolve(score, toBeResolved);

    });

}

const meteArray = () => {
    return new Sequelize.Promise((resolve,reject) => {
        //let toBeResolved = [];
        models.quiz.findAll()
        .each(quiz => {
            toBeResolved.push(quiz)
        })
        resolve(toBeResolved)
    });
};

const arrayVacio = score => {
    return new Sequelize.Promise((resolve, reject) => {
        log(` No hay nada mas que preguntar. `, 'white');
        log(` Fin del examen. Aciertos: `, 'white');
        biglog(` ${score} `, 'magenta');
        resolve(score);
    });
}

const arrayLleno = toBeResolved => {

    let valorAleatorio = Math.floor(Math.random() * toBeResolved.length);
    let prueba = toBeResolved.findById(valorAleatorio);

    return new Sequelize.Promise((resolve, reject) => {
        toBeResolved.splice(valorAleatorio, 1);
        resolve(prueba);
    });
}

const finExamen = score => {
    log(`INCORRECTO.`, 'white');
    log(` Fin del examen. Aciertos: `);
    biglog(` ${score} `);
}

const condicion = (toBeResolved, rl) => {
    let score = 0;
    return new Sequelize.Promise((resolve, reject) => {
        if (toBeResolved.length === 0) {
            arrayVacio(score)
                .then(() => {
                    rl.prompt();
                })
        } else {
            arrayLleno(toBeResolved)
            .then(prueba => {
                makeQuestion(rl , ` ${prueba.question}? `)
                .then(a => {
                    if (a.trim().toLowerCase() === prueba.answer.toLowerCase()) {
                        score++;
                        log(` CORRECTO - Lleva ${score} aciertos `, 'white');
                        playOne();

                    } else {
                        finExamen(score)
                        .then(() => {
                            rl.prompt();
                        })
                    }
                })
            })
            .then(() => {
                rl.prompt();
            })
        }
        resolve(toBeResolved);
    });
};
const playOne = (toBeResolved, rl) => {
    return new Sequelize.Promise((resolve, reject) => {
        condicion(toBeResolved,rl)
    resolve(toBeResolved)
    });

};*/

/**
 * Pregunta todos los quizzes existentes en el modelo en orden aleatorio.
 * Se gana si se contesta a todos satisfactoriamente.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */
exports.playCmd = (socket,rl) => {

    let score = 0;
    let toBeResolved = [];

    models.quiz.findAll()
        .each(quiz => {
            toBeResolved.push(quiz);
        })


        .then(()  => {
            const playOne = () => {

                if (toBeResolved.length === 0) {

                    log(socket,` No hay nada mas que preguntar. `, 'white');
                    log(socket,` Fin del examen. Aciertos: `, 'white');
                    biglog(socket,` ${score} `, 'magenta');
                    rl.prompt();
                } else {

                    let valorAleatorio = (Math.floor((Math.random() * (toBeResolved.length))))
                    validateId(valorAleatorio)
                        .then(valorAleatorio => {
                            let prueba = toBeResolved[valorAleatorio]

                            makeQuestion(rl, ` ${prueba.question}? `)
                                .then(respuesta => {
                                    if (respuesta.trim().toLowerCase() === prueba.answer.toLowerCase()) {
                                        score++;
                                        toBeResolved.splice(valorAleatorio, 1);
                                        log(socket,` CORRECTO - Lleva ${score} aciertos `, 'white');
                                        playOne();
                                    } else {
                                        log(socket,`INCORRECTO.`, 'white');
                                        log(socket,` Fin del examen. Aciertos: `);
                                        biglog(socket,` ${score} `);
                                        rl.prompt();
                                    }
                                })
                        })
                }
            }
            playOne();
        });
};



/**
 * Muestra los nombres de los autores de la práctica.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */
exports.creditsCmd = (socket,rl) => {
    log(socket,'Autores de la práctica:');
    log(socket,'Nombre 1', 'green');
    log(socket,'Nombre 2', 'green');
    rl.prompt();
};


/**
 * Terminar el programa.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */
exports.quitCmd = (socket,rl )=> {
    rl.close();
    socket.end();
};