import React, { useEffect, useState } from 'react';

import api from '../../services/api';

import logoAdventista from '../../assets/logoAdventistaCentenario.png';
import logoGostosoSabor from '../../assets/GostososaborlogoreduzidoGIMP.png';

import './MenuPage.css';


export default function Cardapio() {

  const [studentName, setStudentName] = useState('');

  const [pickupDate, setPickupDate] = useState('');

  const [pickupTime, setPickupTime] = useState('09:30');

  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const [cart, setCart] = useState([]);

  const [products, setProducts] = useState([]);

  const [loadingProducts, setLoadingProducts] = useState(true);


  // =========================================================
  // CARREGAR PRODUTOS
  // =========================================================

  useEffect(() => {

    loadProducts();

  }, []);


  const loadProducts = async () => {

    setLoadingProducts(true);

    try {

      const res = await api.get('/products');

      // Somente produtos disponíveis aparecem para os alunos
      const availableProducts = res.data.filter(
        product => product.available !== false
      );

      setProducts(availableProducts);

    } catch (error) {

      console.error('Erro ao carregar cardápio:', error);

    } finally {

      setLoadingProducts(false);

    }

  };


  // =========================================================
  // CATEGORIAS
  // =========================================================

  const categories = [
    'Todos',
    'Salgados',
    'Bebidas',
    'Sobremesas',
    'Opções Saudáveis'
  ];


  // =========================================================
  // PRODUTOS FILTRADOS
  // =========================================================

  const filteredProducts = products.filter(product => {

    if (selectedCategory === 'Todos') {
      return true;
    }

    return product.category === selectedCategory;

  });


  // =========================================================
  // CARRINHO
  // =========================================================

  const addToCart = (product) => {

    setCart(prev => {

      const existing = prev.find(
        item => item.id === product.id
      );


      if (existing) {

        return prev.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1
              }
            : item
        );

      }


      return [
        ...prev,
        {
          ...product,
          quantity: 1
        }
      ];

    });

  };


  const updateQuantity = (id, delta) => {

    setCart(prev =>

      prev
        .map(item => {

          if (item.id === id) {

            const newQty =
              item.quantity + delta;

            return newQty > 0
              ? {
                  ...item,
                  quantity: newQty
                }
              : null;

          }

          return item;

        })
        .filter(Boolean)

    );

  };


  const cartTotal = cart.reduce(
    (acc, item) =>
      acc +
      Number(item.price) *
      item.quantity,
    0
  );


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="page-wrapper">

      {/* NAVBAR */}

      <nav className="top-navbar">

        <ul className="top-navbar-links">

          <li>
            <a href="#rede">
              A Rede
            </a>
          </li>

          <li>
            <a href="#historia">
              Nossa História
            </a>
          </li>

          <li>
            <a href="#proposta">
              Proposta Educacional
            </a>
          </li>

        </ul>

        <a
          href="#portal"
          className="portal-badge"
        >
          Acessar Portal
        </a>

      </nav>


      <div className="menu-container">

        {/* HEADER */}

        <header className="menu-header">

          <div className="brand-logo">

            <img
              src={logoGostosoSabor}
              alt="Gostoso Sabor"
              className="logo-adventista logo-gostoso"
            />

          </div>


          <div className="header-title">

            <h1>
              Gostoso Sabor - Cantina
            </h1>

            <p>
              Faça seu pedido antecipado com praticidade
            </p>

          </div>


          <div className="brand-logo">

            <img
              src={logoGostosoSabor}
              alt="Gostoso Sabor Cantina"
              className="logo-cantina"
            />

          </div>

        </header>


        {/* IDENTIFICAÇÃO */}

        <section className="form-card">

          <div className="form-group">

            <label htmlFor="studentName">
              Nome do Aluno
            </label>

            <input
              id="studentName"
              type="text"
              placeholder="Digite o nome completo do aluno"
              value={studentName}
              onChange={(e) =>
                setStudentName(e.target.value)
              }
            />

          </div>


          <div className="form-group">

            <label htmlFor="pickupDate">
              Data de Retirada
            </label>

            <input
              id="pickupDate"
              type="date"
              value={pickupDate}
              onChange={(e) =>
                setPickupDate(e.target.value)
              }
            />

          </div>


          <div className="form-group">

            <label htmlFor="pickupTime">
              Horário / Recreio
            </label>

            <select
              id="pickupTime"
              value={pickupTime}
              onChange={(e) =>
                setPickupTime(e.target.value)
              }
            >

              <option value="09:30">
                1º Recreio (09:30)
              </option>

              <option value="15:30">
                2º Recreio (15:30)
              </option>

            </select>

          </div>

        </section>


        {/* CATEGORIAS */}

        <div className="category-tabs">

          {categories.map(category => (

            <button
              key={category}
              className={
                `tab-btn ${
                  selectedCategory === category
                    ? 'active'
                    : ''
                }`
              }
              onClick={() =>
                setSelectedCategory(category)
              }
            >
              {category}
            </button>

          ))}

        </div>


        {/* PRODUTOS */}

        <section className="products-grid">

          {loadingProducts ? (

            <div className="empty-cart">
              Carregando cardápio...
            </div>

          ) : filteredProducts.length === 0 ? (

            <div className="empty-cart">
              Nenhum produto disponível nesta categoria.
            </div>

          ) : (

            filteredProducts.map(product => (

              <div
                key={product.id}
                className="product-card"
              >

                <div className="product-info">

                  <span className="product-category">
                    {product.category}
                  </span>

                  <h3>
                    {product.name}
                  </h3>

                  <p>
                    {product.description ||
                      'Produto da Cantina'}
                  </p>

                </div>


                <div className="product-footer">

                  <span className="price">
                    R$ {Number(
                      product.price
                    ).toFixed(2)}
                  </span>


                  <button
                    className="btn-add"
                    onClick={() =>
                      addToCart(product)
                    }
                  >
                    Adicionar
                  </button>

                </div>

              </div>

            ))

          )}

        </section>


        {/* CARRINHO */}

        <section className="cart-card">

          <h2>
            Seu Carrinho
          </h2>


          {cart.length === 0 ? (

            <p className="empty-cart">
              Nenhum item selecionado até o momento.
            </p>

          ) : (

            <div className="cart-items-list">

              {cart.map(item => (

                <div
                  key={item.id}
                  className="cart-item-row"
                >

                  <span>
                    {item.name}
                  </span>


                  <div className="cart-item-controls">

                    <button
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          -1
                        )
                      }
                    >
                      −
                    </button>


                    <span>
                      {item.quantity}
                    </span>


                    <button
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          1
                        )
                      }
                    >
                      +
                    </button>

                  </div>


                  <strong>
                    R$ {(
                      Number(item.price) *
                      item.quantity
                    ).toFixed(2)}
                  </strong>

                </div>

              ))}

            </div>

          )}


          <div className="cart-summary">

            <span>
              Total do Pedido:
            </span>

            <strong>
              R$ {cartTotal.toFixed(2)}
            </strong>

          </div>


          <button
            className="btn-submit"
            disabled={
              cart.length === 0 ||
              !studentName ||
              !pickupDate
            }
          >
            Finalizar Pedido
          </button>

        </section>

      </div>

    </div>

  );

}